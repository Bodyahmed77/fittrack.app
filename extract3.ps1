$l = Get-Content 'src\App.jsx'
for ($i = 9896; $i -lt $l.Count; $i++) {
    Write-Output (('{0}: {1}' -f ($i + 1), $l[$i]))
}
