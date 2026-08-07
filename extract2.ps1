$l = Get-Content 'src\App.jsx'
for ($i = 6540; $i -le 6615; $i++) {
    Write-Output (('{0}: {1}' -f ($i + 1), $l[$i]))
}
