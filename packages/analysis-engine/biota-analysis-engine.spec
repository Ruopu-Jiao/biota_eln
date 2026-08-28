# -*- mode: python ; coding: utf-8 -*-

entry_point = os.path.join(SPECPATH, "src", "biota_analysis", "__main__.py")
source_path = os.path.join(SPECPATH, "src")

hiddenimports = [
    "scipy.optimize",
    "scipy.stats",
    "statsmodels.regression.linear_model",
    "statsmodels.stats.anova",
    "statsmodels.stats.multicomp",
]

excludes = [
    "IPython",
    "matplotlib",
    "notebook",
    # These are test payloads pulled in by package hooks, not runtime imports.
    # NumPy/SciPy/Pandas/Statsmodels testing *helpers* cannot be excluded because
    # those libraries import the helpers during normal package initialization.
    "numpy._core._multiarray_tests",
    "patsy.test_splines_bs_data",
    "patsy.test_splines_crs_data",
    "patsy.test_state",
    "pytest",
    # OLS imports time-series helpers for optional methods, but Biota's ANOVA
    # path never uses the compiled Kalman/state-space implementation.
    "statsmodels.tsa.statespace",
]

analysis = Analysis(
    [entry_point],
    pathex=[source_path],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
)
pyz = PYZ(analysis.pure)
exe = EXE(
    pyz,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name="biota-analysis-engine",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    target_arch="arm64",
)
runtime = COLLECT(
    exe,
    analysis.binaries,
    analysis.datas,
    strip=False,
    upx=False,
    name="biota-analysis-engine-runtime",
)
