Font download helper

Run `./download_inter_fonts.sh` from the repository root to download Inter woff2 files for the selected weights and generate a local CSS file `frontend/src/inter-local.css` which will reference the downloaded font files under `public/fonts/Inter`.

This script uses Google Fonts CSS as a source of woff2 URLs and downloads the files. It is intended for build-time usage in CI or locally. Ensure you have `curl` installed.
