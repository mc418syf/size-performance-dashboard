param(
  [Parameter(Mandatory=$true)]
  [string]$WorkbookPath,

  [int]$Rows = 12
)

Add-Type -AssemblyName System.IO.Compression

function Read-ZipText($zip, $name) {
  $entry = $zip.GetEntry($name)
  if ($null -eq $entry) { return $null }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Load-SharedStrings($zip) {
  $strings = New-Object System.Collections.ArrayList
  $xmlText = Read-ZipText $zip 'xl/sharedStrings.xml'
  if ($null -eq $xmlText) { return $strings }

  foreach ($match in [regex]::Matches($xmlText, '<si>(.*?)</si>', [System.Text.RegularExpressions.RegexOptions]::Singleline)) {
    $item = $match.Groups[1].Value
    $text = ''
    foreach ($t in [regex]::Matches($item, '<t(?: [^>]*)?>(.*?)</t>|<t/>', [System.Text.RegularExpressions.RegexOptions]::Singleline)) {
      if ($t.Groups.Count -gt 1) {
        $text += [System.Net.WebUtility]::HtmlDecode($t.Groups[1].Value)
      }
    }
    [void]$strings.Add($text)
  }
  return $strings
}

function Column-Index($cellRef) {
  $letters = ([regex]::Match($cellRef, '^[A-Z]+')).Value
  $n = 0
  foreach ($ch in $letters.ToCharArray()) {
    $n = ($n * 26) + ([int][char]$ch - [int][char]'A' + 1)
  }
  return $n
}

function Read-SheetRows($zip, $sheetPath, $sharedStrings, $maxRows) {
  $entry = $zip.GetEntry($sheetPath)
  if ($null -eq $entry) { return @() }

  $settings = New-Object System.Xml.XmlReaderSettings
  $settings.IgnoreWhitespace = $true
  $reader = [System.Xml.XmlReader]::Create($entry.Open(), $settings)
  $rowsOut = New-Object System.Collections.ArrayList
  $row = $null
  $cellRef = $null
  $cellType = $null
  $cellValue = $null
  $inlineText = $null

  try {
    while ($reader.Read()) {
      if ($reader.NodeType -eq [System.Xml.XmlNodeType]::Element -and $reader.LocalName -eq 'row') {
        $row = @{}
      } elseif ($reader.NodeType -eq [System.Xml.XmlNodeType]::Element -and $reader.LocalName -eq 'c') {
        $cellRef = $reader.GetAttribute('r')
        $cellType = $reader.GetAttribute('t')
        $cellValue = $null
        $inlineText = $null
      } elseif ($reader.NodeType -eq [System.Xml.XmlNodeType]::Element -and $reader.LocalName -eq 'v') {
        $cellValue = $reader.ReadElementContentAsString()
        if ($null -ne $cellRef) {
          $value = $cellValue
          if ($cellType -eq 's' -and $cellValue -match '^\d+$') {
            $idx = [int]$cellValue
            if ($idx -lt $sharedStrings.Count) { $value = $sharedStrings[$idx] }
          }
          if ($null -ne $value -and $value -ne '') {
            $row[(Column-Index $cellRef)] = $value
          }
        }
      } elseif ($reader.NodeType -eq [System.Xml.XmlNodeType]::Element -and $reader.LocalName -eq 't') {
        $inlineText += $reader.ReadElementContentAsString()
        if ($cellType -eq 'inlineStr' -and $null -ne $cellRef -and $inlineText -ne '') {
          $row[(Column-Index $cellRef)] = $inlineText
        }
      } elseif ($reader.NodeType -eq [System.Xml.XmlNodeType]::EndElement -and $reader.LocalName -eq 'c') {
        if ($null -ne $cellRef) {
          $value = $cellValue
          if ($cellType -eq 's' -and $cellValue -match '^\d+$') {
            $idx = [int]$cellValue
            if ($idx -lt $sharedStrings.Count) { $value = $sharedStrings[$idx] }
          } elseif ($cellType -eq 'inlineStr') {
            $value = $inlineText
          }
          if ($null -ne $value -and $value -ne '') {
            $row[(Column-Index $cellRef)] = $value
          }
        }
      } elseif ($reader.NodeType -eq [System.Xml.XmlNodeType]::EndElement -and $reader.LocalName -eq 'row') {
        if ($row.Count -gt 0) {
          $maxCol = 0
          foreach ($key in $row.Keys) { if ($key -gt $maxCol) { $maxCol = $key } }
          $values = @()
          for ($i = 1; $i -le $maxCol; $i++) { $values += $row[$i] }
          [void]$rowsOut.Add($values)
          if ($rowsOut.Count -ge $maxRows) { break }
        }
      }
    }
  } finally {
    $reader.Dispose()
  }
  return $rowsOut
}

$fs = [System.IO.File]::Open($WorkbookPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Read)
try {
  [xml]$workbook = Read-ZipText $zip 'xl/workbook.xml'
  [xml]$rels = Read-ZipText $zip 'xl/_rels/workbook.xml.rels'
  $ns = New-Object System.Xml.XmlNamespaceManager($workbook.NameTable)
  $ns.AddNamespace('m', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
  $ns.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $relMap = @{}
  foreach ($rel in $rels.Relationships.Relationship) { $relMap[$rel.Id] = $rel.Target }
  $sharedStrings = Load-SharedStrings $zip

  foreach ($sheet in $workbook.SelectNodes('//m:sheet', $ns)) {
    $rid = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $path = 'xl/' + $relMap[$rid]
    Write-Output ("`n### " + $sheet.name + " (" + $path + ")")
    $rowsOut = Read-SheetRows $zip $path $sharedStrings $Rows
    $line = 1
    foreach ($r in $rowsOut) {
      Write-Output (($line.ToString().PadLeft(2, '0')) + ': ' + (($r | ForEach-Object { if ($null -eq $_) { '' } else { $_ } }) -join ' | '))
      $line++
    }
  }
} finally {
  $zip.Dispose()
  $fs.Dispose()
}
