param(
  [Parameter(Mandatory=$true)]
  [string[]]$WorkbookPath,

  [Parameter(Mandatory=$true)]
  [string]$OutputPath
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

function Normalize-Value($value) {
  if ($null -eq $value) { return '' }
  return [string]$value
}

function Read-Sheet($zip, $sheetPath, $sharedStrings) {
  $entry = $zip.GetEntry($sheetPath)
  if ($null -eq $entry) { return @() }

  $settings = New-Object System.Xml.XmlReaderSettings
  $settings.IgnoreWhitespace = $true
  $reader = [System.Xml.XmlReader]::Create($entry.Open(), $settings)
  $rowsOut = New-Object System.Collections.ArrayList
  $row = $null
  $cellRef = $null
  $cellType = $null
  $inlineText = $null

  try {
    while ($reader.Read()) {
      if ($reader.NodeType -eq [System.Xml.XmlNodeType]::Element -and $reader.LocalName -eq 'row') {
        $row = @{}
      } elseif ($reader.NodeType -eq [System.Xml.XmlNodeType]::Element -and $reader.LocalName -eq 'c') {
        $cellRef = $reader.GetAttribute('r')
        $cellType = $reader.GetAttribute('t')
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
      } elseif ($reader.NodeType -eq [System.Xml.XmlNodeType]::EndElement -and $reader.LocalName -eq 'row') {
        if ($row.Count -gt 0) {
          $maxCol = 0
          foreach ($key in $row.Keys) { if ($key -gt $maxCol) { $maxCol = $key } }
          $values = @()
          for ($i = 1; $i -le $maxCol; $i++) { $values += (Normalize-Value $row[$i]) }
          [void]$rowsOut.Add($values)
        }
      }
    }
  } finally {
    $reader.Dispose()
  }
  return $rowsOut
}

function Sheet-Map($zip) {
  [xml]$workbook = Read-ZipText $zip 'xl/workbook.xml'
  [xml]$rels = Read-ZipText $zip 'xl/_rels/workbook.xml.rels'
  $ns = New-Object System.Xml.XmlNamespaceManager($workbook.NameTable)
  $ns.AddNamespace('m', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
  $ns.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $relMap = @{}
  foreach ($rel in $rels.Relationships.Relationship) { $relMap[$rel.Id] = $rel.Target }
  $map = @{}
  foreach ($sheet in $workbook.SelectNodes('//m:sheet', $ns)) {
    $rid = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $map[$sheet.name] = 'xl/' + $relMap[$rid]
  }
  return $map
}

function To-Number($value) {
  $n = 0.0
  if ([double]::TryParse([string]$value, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$n)) {
    return $n
  }
  return 0.0
}

function Excel-Date($value) {
  $serial = To-Number $value
  if ($serial -le 0) { return '' }
  return ([datetime]'1899-12-30').AddDays($serial).ToString('yyyy-MM-dd')
}

function First-Sunday-Of-February($year) {
  $date = [datetime]::new($year, 2, 1)
  while ($date.DayOfWeek -ne [System.DayOfWeek]::Sunday) {
    $date = $date.AddDays(1)
  }
  return $date
}

function Retail-Week-Info($isoDate) {
  if ([string]::IsNullOrWhiteSpace($isoDate)) {
    return [ordered]@{ week = ''; weekNumber = 0; fy = ''; weekStart = ''; weekEnd = '' }
  }

  $date = [datetime]::ParseExact($isoDate, 'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
  $fyStart = First-Sunday-Of-February $date.Year
  $fyLabelYear = $date.Year + 1
  if ($date -lt $fyStart) {
    $fyStart = First-Sunday-Of-February ($date.Year - 1)
    $fyLabelYear = $date.Year
  }

  $days = [int]($date.Date - $fyStart.Date).TotalDays
  $weekNumber = [math]::Floor($days / 7) + 1
  $weekStart = $fyStart.AddDays(($weekNumber - 1) * 7)
  $weekEnd = $weekStart.AddDays(6)

  return [ordered]@{
    week = 'WK' + $weekNumber
    weekNumber = $weekNumber
    fy = 'FY' + ($fyLabelYear % 100).ToString('00')
    weekStart = $weekStart.ToString('yyyy-MM-dd')
    weekEnd = $weekEnd.ToString('yyyy-MM-dd')
  }
}

function Safe-Key($value, $fallback) {
  $v = ([string]$value).Trim()
  if ($v -eq '') { return $fallback }
  return $v
}

function Add-Metric($map, $key, $sales, $units) {
  if (-not $map.ContainsKey($key)) {
    $map[$key] = [ordered]@{ netSales = 0.0; units = 0.0 }
  }
  $map[$key].netSales += $sales
  $map[$key].units += $units
}

function Top-Array($map, $limit) {
  $items = @()
  foreach ($key in $map.Keys) {
    $value = $map[$key]
    $obj = [ordered]@{ name = $key; netSales = [math]::Round($value.netSales, 2); units = [math]::Round($value.units, 2) }
    if ($value.Contains('image')) { $obj.image = $value.image }
    if ($value.Contains('sku')) { $obj.sku = $value.sku }
    if ($value.Contains('vendor')) { $obj.vendor = $value.vendor }
    if ($value.Contains('productType')) { $obj.productType = $value.productType }
    if ($value.Contains('department')) { $obj.department = $value.department }
    if ($value.Contains('class')) { $obj.class = $value.class }
    if ($value.Contains('status')) { $obj.status = $value.status }
    if ($value.Contains('release')) { $obj.release = $value.release }
    if ($value.Contains('size')) { $obj.size = $value.size }
    if ($value.Contains('season')) { $obj.season = $value.season }
    if ($value.Contains('inventory')) { $obj.inventory = [math]::Round($value.inventory, 2) }
    $items += [pscustomobject]$obj
  }
  return @($items | Sort-Object -Property netSales -Descending | Select-Object -First $limit)
}

$weeks = New-Object System.Collections.ArrayList
$allRows = New-Object System.Collections.ArrayList

foreach ($path in $WorkbookPath) {
  $fs = [System.IO.File]::Open($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Read)
  try {
    $sheetMap = Sheet-Map $zip
    $sharedStrings = Load-SharedStrings $zip
    $basicRows = Read-Sheet $zip $sheetMap['Basic Worksheet'] $sharedStrings

    $fileWeekMatch = [regex]::Match([System.IO.Path]::GetFileNameWithoutExtension($path), 'WK\s*([0-9]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $fileWeek = if ($fileWeekMatch.Success) { 'WK' + $fileWeekMatch.Groups[1].Value } else { '' }

    $headers = $basicRows[0]
    $idx = @{}
    for ($i = 0; $i -lt $headers.Count; $i++) {
      if (-not [string]::IsNullOrWhiteSpace($headers[$i]) -and -not $idx.ContainsKey($headers[$i])) {
        $idx[$headers[$i]] = $i
      }
    }

    $weekRows = New-Object System.Collections.ArrayList
    for ($i = 1; $i -lt $basicRows.Count; $i++) {
      $r = $basicRows[$i]
      $sku = if ($idx.ContainsKey('SKU') -and $idx['SKU'] -lt $r.Count) { $r[$idx['SKU']] } else { '' }
      $sales = if ($idx.ContainsKey('Net Sales') -and $idx['Net Sales'] -lt $r.Count) { To-Number $r[$idx['Net Sales']] } else { 0.0 }
      $units = if ($idx.ContainsKey('Net Quantity') -and $idx['Net Quantity'] -lt $r.Count) { To-Number $r[$idx['Net Quantity']] } else { 0.0 }
      $date = if ($idx.ContainsKey('Date') -and $idx['Date'] -lt $r.Count) { Excel-Date $r[$idx['Date']] } else { '' }
      if ([string]::IsNullOrWhiteSpace($date)) { continue }
      $weekInfo = Retail-Week-Info $date
      $week = if ($weekInfo.week -ne '') { $weekInfo.week } elseif ($fileWeek -ne '') { $fileWeek } else { [System.IO.Path]::GetFileNameWithoutExtension($path) }
      $title = if ($idx.ContainsKey('Product Title') -and $idx['Product Title'] -lt $r.Count) { Safe-Key $r[$idx['Product Title']] '(no title)' } else { '(no title)' }
      if ($title -match '^\s*Grand\s+Total\s*$' -or $sku -match '^\s*Grand\s+Total\s*$') { continue }
      $vendor = if ($idx.ContainsKey('Product Vendor') -and $idx['Product Vendor'] -lt $r.Count) { Safe-Key $r[$idx['Product Vendor']] '(blank)' } else { '(blank)' }
      $productType = if ($idx.ContainsKey('Product Type') -and $idx['Product Type'] -lt $r.Count) { Safe-Key $r[$idx['Product Type']] '(blank)' } else { '(blank)' }
      $department = if ($idx.ContainsKey('Department') -and $idx['Department'] -lt $r.Count) { Safe-Key $r[$idx['Department']] '(blank)' } else { '(blank)' }
      $class = if ($idx.ContainsKey('CLASS') -and $idx['CLASS'] -lt $r.Count) { Safe-Key $r[$idx['CLASS']] '(blank)' } else { '(blank)' }
      $subClass = if ($idx.ContainsKey('SUB_CLASS') -and $idx['SUB_CLASS'] -lt $r.Count) { Safe-Key $r[$idx['SUB_CLASS']] '(blank)' } else { '(blank)' }
      $status = if ($idx.ContainsKey('Status') -and $idx['Status'] -lt $r.Count) { Safe-Key $r[$idx['Status']] '(blank)' } else { '(blank)' }
      $release = if ($idx.ContainsKey('Release') -and $idx['Release'] -lt $r.Count) { Safe-Key $r[$idx['Release']] '(blank)' } else { '(blank)' }
      $size = if ($idx.ContainsKey('Option 2') -and $idx['Option 2'] -lt $r.Count) { Safe-Key $r[$idx['Option 2']] '(blank)' } else { '(blank)' }
      $season = if ($idx.ContainsKey('Season') -and $idx['Season'] -lt $r.Count) { Safe-Key $r[$idx['Season']] '(blank)' } else { '(blank)' }
      $province = if ($idx.ContainsKey('Shipping Province') -and $idx['Shipping Province'] -lt $r.Count) { Safe-Key $r[$idx['Shipping Province']] '(blank)' } else { '(blank)' }
      $image = if ($idx.ContainsKey('Image URL 1') -and $idx['Image URL 1'] -lt $r.Count) { $r[$idx['Image URL 1']] } else { '' }
      $inventory = if ($idx.ContainsKey('Inventory Quantity') -and $idx['Inventory Quantity'] -lt $r.Count) { To-Number $r[$idx['Inventory Quantity']] } else { 0.0 }

      [void]$weekRows.Add([ordered]@{
        date = $date
        week = $week
        weekNumber = $weekInfo.weekNumber
        fy = $weekInfo.fy
        weekStart = $weekInfo.weekStart
        weekEnd = $weekInfo.weekEnd
        sku = $sku
        title = $title
        vendor = $vendor
        productType = $productType
        department = $department
        class = $class
        subClass = $subClass
        status = $status
        release = $release
        size = $size
        season = $season
        province = $province
        image = $image
        netSales = [math]::Round($sales, 2)
        units = [math]::Round($units, 2)
        inventory = [math]::Round($inventory, 2)
      })
    }

    [void]$weeks.Add([ordered]@{
      week = if ($weekRows.Count -gt 0) { (@($weekRows | ForEach-Object { $_.week } | Sort-Object -Unique) -join ', ') } elseif ($fileWeek -ne '') { $fileWeek } else { [System.IO.Path]::GetFileNameWithoutExtension($path) }
      source = [System.IO.Path]::GetFileName($path)
      rowCount = $weekRows.Count
    })

    foreach ($row in $weekRows) { [void]$allRows.Add($row) }
  } finally {
    $zip.Dispose()
    $fs.Dispose()
  }
}

$byWeek = @{}
$byDate = @{}
$byStatus = @{}
$byRelease = @{}
$bySize = @{}
$bySeason = @{}
$byVendor = @{}
$byProductType = @{}
$byDepartment = @{}
$byClass = @{}
$bySubClass = @{}
$byProvince = @{}
$byProduct = @{}

$totalSales = 0.0
$totalUnits = 0.0

foreach ($row in $allRows) {
  $sales = $row.netSales
  $units = $row.units
  $totalSales += $sales
  $totalUnits += $units
  Add-Metric $byWeek $row.week $sales $units
  Add-Metric $byDate $row.date $sales $units
  Add-Metric $byStatus $row.status $sales $units
  Add-Metric $byRelease $row.release $sales $units
  Add-Metric $bySize $row.size $sales $units
  Add-Metric $bySeason $row.season $sales $units
  Add-Metric $byVendor $row.vendor $sales $units
  Add-Metric $byProductType $row.productType $sales $units
  Add-Metric $byDepartment $row.department $sales $units
  Add-Metric $byClass $row.class $sales $units
  Add-Metric $bySubClass $row.subClass $sales $units
  Add-Metric $byProvince $row.province $sales $units

  $productKey = $row.title
  if (-not $byProduct.ContainsKey($productKey)) {
    $byProduct[$productKey] = [ordered]@{
      netSales = 0.0
      units = 0.0
      image = $row.image
      sku = $row.sku
      vendor = $row.vendor
      productType = $row.productType
      department = $row.department
      class = $row.class
      subClass = $row.subClass
      status = $row.status
      release = $row.release
      size = $row.size
      season = $row.season
      inventory = 0.0
    }
  }
  $byProduct[$productKey].netSales += $sales
  $byProduct[$productKey].units += $units
  if ($row.inventory -gt $byProduct[$productKey].inventory) {
    $byProduct[$productKey].inventory = $row.inventory
  }
}

$dateTrend = @()
foreach ($key in ($byDate.Keys | Sort-Object)) {
  $dateTrend += [ordered]@{ date = $key; netSales = [math]::Round($byDate[$key].netSales, 2); units = [math]::Round($byDate[$key].units, 2) }
}

$weekTrend = @()
foreach ($key in ($byWeek.Keys | Sort-Object)) {
  $weekTrend += [ordered]@{ week = $key; netSales = [math]::Round($byWeek[$key].netSales, 2); units = [math]::Round($byWeek[$key].units, 2) }
}

$payload = [ordered]@{
  generatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
  sourceFiles = @($weeks)
  totals = [ordered]@{
    netSales = [math]::Round($totalSales, 2)
    units = [math]::Round($totalUnits, 2)
    aov = if ($totalUnits -ne 0) { [math]::Round($totalSales / $totalUnits, 2) } else { 0 }
    products = $byProduct.Keys.Count
  }
  filters = [ordered]@{
    weeks = @($byWeek.Keys | Sort-Object)
    dates = @($byDate.Keys | Sort-Object)
    statuses = @($byStatus.Keys | Sort-Object)
    releases = @($byRelease.Keys | Sort-Object)
    sizes = @($bySize.Keys | Sort-Object)
    seasons = @($bySeason.Keys | Sort-Object)
    vendors = @($byVendor.Keys | Sort-Object)
    productTypes = @($byProductType.Keys | Sort-Object)
    departments = @($byDepartment.Keys | Sort-Object)
    classes = @($byClass.Keys | Sort-Object)
    subClasses = @($bySubClass.Keys | Sort-Object)
  }
  series = [ordered]@{
    byDate = $dateTrend
    byWeek = $weekTrend
    byStatus = Top-Array $byStatus 20
    byRelease = Top-Array $byRelease 20
    bySize = Top-Array $bySize 20
    bySeason = Top-Array $bySeason 20
    byVendor = Top-Array $byVendor 20
    byProductType = Top-Array $byProductType 20
    byDepartment = Top-Array $byDepartment 20
    byClass = Top-Array $byClass 20
    bySubClass = Top-Array $bySubClass 20
    byProvince = Top-Array $byProvince 20
    topProducts = Top-Array $byProduct 75
  }
  rows = @($allRows)
}

$json = $payload | ConvertTo-Json -Depth 8 -Compress
$dir = Split-Path -Parent $OutputPath
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
Set-Content -LiteralPath $OutputPath -Value $json -Encoding UTF8
Write-Output "Exported $($allRows.Count) rows to $OutputPath"
