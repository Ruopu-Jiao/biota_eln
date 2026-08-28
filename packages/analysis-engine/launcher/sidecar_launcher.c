#define _DARWIN_C_SOURCE
#define _XOPEN_SOURCE 700

#include <errno.h>
#include <fcntl.h>
#include <ftw.h>
#include <limits.h>
#include <mach-o/getsect.h>
#include <mach-o/ldsyms.h>
#include <spawn.h>
#include <stdbool.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#ifndef PAYLOAD_SHA
#error "PAYLOAD_SHA must be defined by the packaging script"
#endif

#define ENGINE_NAME "biota-analysis-engine"
#define CACHE_NAMESPACE "com.biota.eln/analysis-engine"

extern char **environ;

static int report_error(const char *format, ...) {
    va_list arguments;
    va_start(arguments, format);
    fputs("Biota analysis launcher: ", stderr);
    vfprintf(stderr, format, arguments);
    fputc('\n', stderr);
    va_end(arguments);
    return EXIT_FAILURE;
}

static int report_errno(const char *operation, const char *path) {
    return report_error("%s %s: %s", operation, path, strerror(errno));
}

static bool checked_path(char *target, size_t size, const char *format, ...) {
    va_list arguments;
    va_start(arguments, format);
    int written = vsnprintf(target, size, format, arguments);
    va_end(arguments);
    return written >= 0 && (size_t)written < size;
}

static int ensure_private_directory(const char *path) {
    if (mkdir(path, 0700) == 0) {
        return 0;
    }
    if (errno != EEXIST) {
        return -1;
    }

    struct stat metadata;
    if (lstat(path, &metadata) != 0) {
        return -1;
    }
    if (!S_ISDIR(metadata.st_mode) || metadata.st_uid != getuid()) {
        errno = EPERM;
        return -1;
    }
    if ((metadata.st_mode & 0077) != 0 && chmod(path, 0700) != 0) {
        return -1;
    }
    return 0;
}

static bool regular_owned_file(const char *path, bool executable) {
    struct stat metadata;
    if (lstat(path, &metadata) != 0 || !S_ISREG(metadata.st_mode)) {
        return false;
    }
    if (metadata.st_uid != getuid() || (metadata.st_mode & 0022) != 0) {
        return false;
    }
    return !executable || access(path, X_OK) == 0;
}

static bool private_owned_directory(const char *path) {
    struct stat metadata;
    return lstat(path, &metadata) == 0 && S_ISDIR(metadata.st_mode) &&
           metadata.st_uid == getuid() && (metadata.st_mode & 0022) == 0;
}

static bool cache_is_ready(
    const char *cache_directory,
    const char *engine_path,
    const char *internal_path,
    const char *marker_path
) {
    if (!private_owned_directory(cache_directory) ||
        !private_owned_directory(internal_path) ||
        !regular_owned_file(engine_path, true) ||
        !regular_owned_file(marker_path, false)) {
        return false;
    }

    int marker = open(marker_path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
    if (marker < 0) {
        return false;
    }
    char value[sizeof(PAYLOAD_SHA)] = {0};
    ssize_t count = read(marker, value, sizeof(value));
    int read_errno = errno;
    close(marker);
    errno = read_errno;
    return count == (ssize_t)strlen(PAYLOAD_SHA) &&
           memcmp(value, PAYLOAD_SHA, strlen(PAYLOAD_SHA)) == 0;
}

static int remove_entry(
    const char *path,
    const struct stat *metadata,
    int type,
    struct FTW *tree
) {
    (void)metadata;
    (void)type;
    (void)tree;
    return remove(path);
}

static void remove_tree(const char *path) {
    struct stat metadata;
    if (lstat(path, &metadata) == 0) {
        (void)nftw(path, remove_entry, 32, FTW_DEPTH | FTW_PHYS);
    }
}

static int write_all(int descriptor, const uint8_t *bytes, size_t size) {
    size_t offset = 0;
    while (offset < size) {
        ssize_t count = write(descriptor, bytes + offset, size - offset);
        if (count < 0) {
            if (errno == EINTR) {
                continue;
            }
            return -1;
        }
        offset += (size_t)count;
    }
    return 0;
}

static int extract_archive(const char *archive_path, const char *destination) {
    pid_t process;
    char *const arguments[] = {
        "tar",
        "-xzf",
        (char *)archive_path,
        "-C",
        (char *)destination,
        NULL,
    };
    int spawn_result = posix_spawn(
        &process,
        "/usr/bin/tar",
        NULL,
        NULL,
        arguments,
        environ
    );
    if (spawn_result != 0) {
        errno = spawn_result;
        return -1;
    }

    int status;
    while (waitpid(process, &status, 0) < 0) {
        if (errno != EINTR) {
            return -1;
        }
    }
    if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) {
        errno = EIO;
        return -1;
    }
    return 0;
}

static int sync_directory(const char *path) {
    int descriptor = open(path, O_RDONLY | O_CLOEXEC);
    if (descriptor < 0) {
        return -1;
    }
    int result = fsync(descriptor);
    int sync_errno = errno;
    close(descriptor);
    errno = sync_errno;
    return result;
}

int main(int argument_count, char **arguments) {
    (void)argument_count;

    unsigned long payload_size = 0;
    const uint8_t *payload = getsectiondata(
        &_mh_execute_header,
        "__DATA",
        "__payload",
        &payload_size
    );
    if (payload == NULL || payload_size == 0) {
        return report_error("embedded runtime payload is missing");
    }

    char cache_base[PATH_MAX];
    size_t required = confstr(
        _CS_DARWIN_USER_CACHE_DIR,
        cache_base,
        sizeof(cache_base)
    );
    if (required == 0 || required > sizeof(cache_base)) {
        const char *home = getenv("HOME");
        if (home == NULL ||
            !checked_path(
                cache_base,
                sizeof(cache_base),
                "%s/Library/Caches/",
                home
            )) {
            return report_error("could not resolve the user cache directory");
        }
    }

    size_t cache_base_length = strlen(cache_base);
    while (cache_base_length > 1 && cache_base[cache_base_length - 1] == '/') {
        cache_base[--cache_base_length] = '\0';
    }

    char application_cache[PATH_MAX];
    char engine_cache_root[PATH_MAX];
    char cache_directory[PATH_MAX];
    char engine_path[PATH_MAX];
    char internal_path[PATH_MAX];
    char marker_path[PATH_MAX];
    char lock_path[PATH_MAX];
    if (!checked_path(
            application_cache,
            sizeof(application_cache),
            "%s/com.biota.eln",
            cache_base
        ) ||
        !checked_path(
            engine_cache_root,
            sizeof(engine_cache_root),
            "%s/%s",
            cache_base,
            CACHE_NAMESPACE
        ) ||
        !checked_path(
            cache_directory,
            sizeof(cache_directory),
            "%s/%s",
            engine_cache_root,
            PAYLOAD_SHA
        ) ||
        !checked_path(
            engine_path,
            sizeof(engine_path),
            "%s/%s",
            cache_directory,
            ENGINE_NAME
        ) ||
        !checked_path(
            internal_path,
            sizeof(internal_path),
            "%s/_internal",
            cache_directory
        ) ||
        !checked_path(
            marker_path,
            sizeof(marker_path),
            "%s/.complete",
            cache_directory
        ) ||
        !checked_path(
            lock_path,
            sizeof(lock_path),
            "%s/%s.lock",
            engine_cache_root,
            PAYLOAD_SHA
        )) {
        return report_error("cache path is too long");
    }

    if (ensure_private_directory(application_cache) != 0) {
        return report_errno("could not create", application_cache);
    }
    if (ensure_private_directory(engine_cache_root) != 0) {
        return report_errno("could not create", engine_cache_root);
    }

    if (cache_is_ready(
            cache_directory,
            engine_path,
            internal_path,
            marker_path
        )) {
        arguments[0] = engine_path;
        execv(engine_path, arguments);
        return report_errno("could not execute", engine_path);
    }

    int lock = open(
        lock_path,
        O_CREAT | O_RDWR | O_CLOEXEC | O_NOFOLLOW,
        0600
    );
    if (lock < 0) {
        return report_errno("could not open lock", lock_path);
    }
    struct stat lock_metadata;
    if (fstat(lock, &lock_metadata) != 0 ||
        !S_ISREG(lock_metadata.st_mode) ||
        lock_metadata.st_uid != getuid() ||
        (lock_metadata.st_mode & 0022) != 0) {
        close(lock);
        return report_error("cache lock is not a private regular file");
    }
    if (flock(lock, LOCK_EX) != 0) {
        int lock_errno = errno;
        close(lock);
        errno = lock_errno;
        return report_errno("could not acquire lock", lock_path);
    }

    if (cache_is_ready(
            cache_directory,
            engine_path,
            internal_path,
            marker_path
        )) {
        arguments[0] = engine_path;
        execv(engine_path, arguments);
        return report_errno("could not execute", engine_path);
    }

    remove_tree(cache_directory);

    char temporary_directory[PATH_MAX];
    if (!checked_path(
            temporary_directory,
            sizeof(temporary_directory),
            "%s/.%s.XXXXXX",
            engine_cache_root,
            PAYLOAD_SHA
        ) ||
        mkdtemp(temporary_directory) == NULL) {
        return report_errno("could not create temporary cache", engine_cache_root);
    }

    char archive_path[PATH_MAX];
    if (!checked_path(
            archive_path,
            sizeof(archive_path),
            "%s/runtime.tar.gz",
            temporary_directory
        )) {
        remove_tree(temporary_directory);
        return report_error("temporary archive path is too long");
    }

    int archive = open(
        archive_path,
        O_CREAT | O_EXCL | O_WRONLY | O_CLOEXEC | O_NOFOLLOW,
        0600
    );
    if (archive < 0) {
        int archive_errno = errno;
        remove_tree(temporary_directory);
        errno = archive_errno;
        return report_errno("could not create embedded runtime", archive_path);
    }
    if (write_all(archive, payload, (size_t)payload_size) != 0 ||
        fsync(archive) != 0) {
        int archive_errno = errno;
        close(archive);
        remove_tree(temporary_directory);
        errno = archive_errno;
        return report_errno("could not write embedded runtime", archive_path);
    }
    if (close(archive) != 0) {
        int archive_errno = errno;
        remove_tree(temporary_directory);
        errno = archive_errno;
        return report_errno("could not close embedded runtime", archive_path);
    }

    if (extract_archive(archive_path, temporary_directory) != 0) {
        int extraction_errno = errno;
        remove_tree(temporary_directory);
        errno = extraction_errno;
        return report_errno("could not extract embedded runtime", archive_path);
    }
    if (unlink(archive_path) != 0) {
        int unlink_errno = errno;
        remove_tree(temporary_directory);
        errno = unlink_errno;
        return report_errno("could not remove temporary archive", archive_path);
    }

    char temporary_engine[PATH_MAX];
    char temporary_internal[PATH_MAX];
    char temporary_marker[PATH_MAX];
    if (!checked_path(
            temporary_engine,
            sizeof(temporary_engine),
            "%s/%s",
            temporary_directory,
            ENGINE_NAME
        ) ||
        !checked_path(
            temporary_internal,
            sizeof(temporary_internal),
            "%s/_internal",
            temporary_directory
        ) ||
        !checked_path(
            temporary_marker,
            sizeof(temporary_marker),
            "%s/.complete",
            temporary_directory
        ) ||
        !regular_owned_file(temporary_engine, true) ||
        !private_owned_directory(temporary_internal)) {
        remove_tree(temporary_directory);
        return report_error("extracted runtime is incomplete");
    }

    int marker = open(
        temporary_marker,
        O_CREAT | O_EXCL | O_WRONLY | O_CLOEXEC | O_NOFOLLOW,
        0600
    );
    if (marker < 0) {
        int marker_errno = errno;
        remove_tree(temporary_directory);
        errno = marker_errno;
        return report_errno("could not create runtime marker", temporary_marker);
    }
    if (write_all(
            marker,
            (const uint8_t *)PAYLOAD_SHA,
            strlen(PAYLOAD_SHA)
        ) != 0 ||
        fsync(marker) != 0) {
        int marker_errno = errno;
        close(marker);
        remove_tree(temporary_directory);
        errno = marker_errno;
        return report_errno("could not finalize runtime marker", temporary_marker);
    }
    if (close(marker) != 0 || sync_directory(temporary_directory) != 0) {
        int marker_errno = errno;
        remove_tree(temporary_directory);
        errno = marker_errno;
        return report_errno("could not finalize runtime marker", temporary_marker);
    }

    if (rename(temporary_directory, cache_directory) != 0 ||
        sync_directory(engine_cache_root) != 0) {
        int rename_errno = errno;
        remove_tree(temporary_directory);
        errno = rename_errno;
        return report_errno("could not publish runtime cache", cache_directory);
    }

    arguments[0] = engine_path;
    execv(engine_path, arguments);
    return report_errno("could not execute", engine_path);
}
