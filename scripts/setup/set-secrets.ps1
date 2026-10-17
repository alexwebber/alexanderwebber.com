<#
.SYNOPSIS
  Prompts once for each named secret and stores it as a GitHub Actions secret on this repo and,
  unless -NoLocal is given, as a user environment variable on this PC (for local spike/backfill
  runs). Values are never echoed, logged or written to a file.

.EXAMPLE
  .\scripts\setup\set-secrets.ps1 R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET

.EXAMPLE
  .\scripts\setup\set-secrets.ps1 -NoLocal GARMIN_EMAIL GARMIN_PASSWORD
#>
param(
    [switch] $NoLocal,
    [Parameter(Mandatory, ValueFromRemainingArguments)] [string[]] $Names
)
$ErrorActionPreference = 'Stop'

foreach ($name in $Names) {
    $secure = Read-Host "Paste $name (input hidden)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    if (-not $plain) { throw "$name is empty; nothing stored." }

    # --body rather than stdin: Windows PowerShell 5.1 adds a BOM/newline when piping to a native exe.
    gh secret set $name --body $plain
    if ($LASTEXITCODE -ne 0) { throw "gh secret set $name failed." }

    if (-not $NoLocal) { [Environment]::SetEnvironmentVariable($name, $plain, 'User') }
    $plain = $null
    $where = if ($NoLocal) { 'GitHub secret' } else { 'GitHub secret + user env var' }
    Write-Host "$name stored ($where)."
}
if (-not $NoLocal) { Write-Host 'Open a new terminal for the user env vars to take effect.' }
