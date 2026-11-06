@echo off
node "%~dp0node_modules\tsx\dist\cli.mjs" "%~dp0scripts\make-view-link.ts" %*
