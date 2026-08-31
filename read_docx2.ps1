$xml = [xml](Get-Content 'C:\Users\KIIT0001\Downloads\cm_doc\word\document.xml')
$text = $xml.Document.body.InnerText
$idx = $text.IndexOf('insertPlayer')
$start = [math]::Max(0, $idx - 200)
$len = [math]::Min($text.Length - $start, 1000)
Write-Output $text.Substring($start, $len)
