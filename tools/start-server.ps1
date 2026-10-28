# Starts server.js and appends its output to server.log, one timestamped line
# at a time, plus a final line with the exit code if it ever stops.
# Used by the "WMMT Daily" scheduled task on this PC.
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$log = Join-Path (Get-Location) 'server.log'
$stamp = { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $_" }
[Console]::OutputEncoding = [Text.Encoding]::UTF8 # node writes UTF-8

"--- starting (pid $PID)" | ForEach-Object $stamp | Out-File $log -Append -Encoding utf8
& node server.js 2>&1 | ForEach-Object { "$_" } | ForEach-Object $stamp | Out-File $log -Append -Encoding utf8
$code = $LASTEXITCODE
"--- server exited with code $code" | ForEach-Object $stamp | Out-File $log -Append -Encoding utf8
exit $code
