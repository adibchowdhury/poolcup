$token = Read-Host "Bot token"
$channelId = Read-Host "Baseball channel ID"

$raw = curl.exe -s -H "Authorization: Bot $token" "https://discord.com/api/v10/channels/$channelId/messages?limit=100"
$msgs = $raw | ConvertFrom-Json
$puckyIds = $msgs | Where-Object { $_.author.bot -eq $true } | ForEach-Object { $_.id }
Write-Host "Found $($msgs.Count) messages, $($puckyIds.Count) from Pucky"

if ($puckyIds.Count -ge 2) {
  $json = (@{ messages = @($puckyIds) } | ConvertTo-Json -Compress).Replace('"','\"')
  curl.exe -s -X POST "https://discord.com/api/v10/channels/$channelId/messages/bulk-delete" -H "Authorization: Bot $token" -H "Content-Type: application/json" -d $json
  Write-Host "Bulk delete sent for $($puckyIds.Count) Pucky messages"
} elseif ($puckyIds.Count -eq 1) {
  curl.exe -s -X DELETE "https://discord.com/api/v10/channels/$channelId/messages/$($puckyIds[0])" -H "Authorization: Bot $token"
  Write-Host "Deleted 1 Pucky message"
} else {
  Write-Host "Nothing to delete"
}