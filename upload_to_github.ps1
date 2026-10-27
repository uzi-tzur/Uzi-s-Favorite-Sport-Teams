# GitHub upload script
param(
    [string]$owner = "uzi-tzur",
    [string]$repo = "Uzi-s-Favorite-Sport-Teams",
    [string]$filePath = "public/logo.jpg",
    [string]$localFile = "C:\Uzi\Uzi's Teams Sport\public\logo.jpg"
)

# Read and encode the file
$bytes = [System.IO.File]::ReadAllBytes($localFile)
$base64 = [Convert]::ToBase64String($bytes)

# Prepare the JSON payload
$body = @{
    message = "Add logo.jpg image"
    content = $base64
    branch = "main"
} | ConvertTo-Json

# Note: This script prepares the data but requires a GitHub token to execute
# Save the base64 content length for verification
Write-Host "File size: $($bytes.Length) bytes"
Write-Host "Base64 length: $($base64.Length) characters"
Write-Host "Ready to upload to: https://api.github.com/repos/$owner/$repo/contents/$filePath"

# Save base64 to a manageable chunk file for manual upload if needed
$outputPath = "C:\Uzi\Uzi's Teams Sport\logo_for_github.txt"
Set-Content -Path $outputPath -Value $base64 -NoNewline
Write-Host "Base64 content saved to: $outputPath"

