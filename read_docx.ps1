$xml = [xml](Get-Content 'C:\Users\KIIT0001\Downloads\cm_doc\word\document.xml')
$text = $xml.Document.body.InnerText
Write-Output $text.Substring(0, [math]::Min($text.Length, 1500))
