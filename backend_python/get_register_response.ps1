try {
    $body = '{"name":"Test User","email":"testuser@example.com","password":"password123","confirmPassword":"password123"}'
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/auth/register' -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 10
    $r.Content
} catch {
    if ($_.Exception.Response -ne $null) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $reader.ReadToEnd()
    } else {
        $_.Exception.Message
    }
}
