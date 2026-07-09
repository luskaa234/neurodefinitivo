param(
  [string]$DocxPath = "c:\Users\lucas\Downloads\LISTA DE PACIENTES E VALORES.docx"
)

$ErrorActionPreference = "Stop"

function Read-EnvValue([string]$Name) {
  $line = Get-Content ".env" | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $line) { throw "Variavel $Name nao encontrada no .env" }
  return ($line -replace "^$Name=", "").Trim().Trim('"')
}

function Normalize-Text([string]$Value) {
  if (-not $Value) { return "" }
  $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object Text.StringBuilder
  foreach ($char in $normalized.ToCharArray()) {
    $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
    if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($char)
    }
  }
  return (($builder.ToString() -replace "\s+", " ").Trim().ToUpperInvariant())
}

function Parse-Money([string]$Value) {
  $raw = [regex]::Match($Value, "\d{2,3}(?:[,.]\d{1,3})?").Value
  if (-not $raw) { return 0 }
  $normalized = ($raw -replace "[^\d,.-]", "") -replace "\.(?=\d{3}(?:\D|$))", ""
  $normalized = $normalized -replace ",", "."
  $number = 0.0
  if ([double]::TryParse($normalized, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    return $number
  }
  return 0
}

function Parse-ExpressionAmount([string]$Value) {
  $raw = $Value.Trim()
  if (-not $raw) { return 0 }
  $expression = if ($raw.Contains("=")) { ($raw -split "=")[-1] } else { $raw }
  if ($expression.Contains("+")) {
    $sum = 0.0
    foreach ($part in ($expression -split "\+")) {
      $sum += Parse-Money $part
    }
    return $sum
  }
  return Parse-Money $expression
}

function Extract-DocxText([string]$Path) {
  if (-not (Test-Path $Path)) { throw "Arquivo nao encontrado: $Path" }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $entry = $zip.GetEntry("word/document.xml")
    if (-not $entry) { throw "document.xml nao encontrado no DOCX" }
    $reader = New-Object IO.StreamReader($entry.Open())
    try { $xmlText = $reader.ReadToEnd() } finally { $reader.Dispose() }
  } finally {
    $zip.Dispose()
  }

  [xml]$xml = $xmlText
  $ns = New-Object Xml.XmlNamespaceManager($xml.NameTable)
  $ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

  $rows = New-Object Collections.Generic.List[string]
  $tables = $xml.SelectNodes("//w:tr", $ns)
  foreach ($tr in $tables) {
    $cells = @()
    foreach ($tc in $tr.SelectNodes("./w:tc", $ns)) {
      $text = (($tc.SelectNodes(".//w:t", $ns) | ForEach-Object { $_.'#text' }) -join " ").Trim()
      if ($text) { $cells += ($text -replace "\s+", " ").Trim() }
    }
    if ($cells.Count) { $rows.Add(($cells -join " | ")) }
  }

  if ($rows.Count -eq 0) {
    foreach ($p in $xml.SelectNodes("//w:p", $ns)) {
      $text = (($p.SelectNodes(".//w:t", $ns) | ForEach-Object { $_.'#text' }) -join "").Trim()
      if ($text) { $rows.Add(($text -replace "\s+", " ").Trim()) }
    }
  }

  return $rows
}

function Convert-ToTabelaValores([string[]]$Lines) {
  $especialidades = @("FONO", "FISIO", "T.O", "PSICOLOGIA", "PSICOPEDAGOGIA", "MUSICA", "NEUROPSICOLOGA")
  $convenios = @("UNIMED TERESINA", "UNIMED SEGUROS", "UNIMED MARANHAO", "UNIMED SAO PAULO", "UNIMED FORTALEZA", "SULA AMERICA", "HUMANA SAUDE", "FINAL DE MES")
  $records = New-Object Collections.Generic.List[object]
  $seen = New-Object Collections.Generic.HashSet[string]
  $pacienteAtual = ""
  $convenioAtual = ""
  $especialidadeAtual = ""
  $totalPendente = $null
  $profissionalPendente = $null

  foreach ($line in $Lines) {
    $linha = $line.Trim()
    if (-not $linha) { continue }
    $normal = Normalize-Text $linha
    $isConvenio = $false
    foreach ($convenio in $convenios) {
      if ($normal.Contains($convenio)) { $isConvenio = $true; break }
    }
    $foundEspecialidades = @()
    foreach ($especialidade in $especialidades) {
      if ($normal -match "(^|[^A-Z])$([regex]::Escape($especialidade))([^A-Z]|$)") {
        $foundEspecialidades += $especialidade
      }
    }
    if ($normal.Contains("PSICOPEGAGOGIA")) { $foundEspecialidades += "PSICOPEDAGOGIA" }
    $moneyMatches = [regex]::Matches($linha, "\d{2,3}(?:[,.]\d{1,3})?")

    if ($isConvenio -and $moneyMatches.Count -eq 0) {
      $convenioAtual = (($linha -replace "\(.*?\)", "") -replace "-+", " ").Trim()
      continue
    }

    if ($foundEspecialidades.Count -gt 0 -and $moneyMatches.Count -eq 0) {
      $especialidadeAtual = (($foundEspecialidades | Select-Object -Unique) -join " ")
      continue
    }

    if ($normal.Contains("TOTAL") -and $moneyMatches.Count -gt 0) {
      $totalPendente = Parse-Money $linha
      continue
    }

    if ($normal.Contains("70%")) {
      $afterColon = if ($linha.Contains(":")) { ($linha -split ":", 2)[1] } else { $linha }
      $profissionalPendente = Parse-ExpressionAmount $afterColon
      continue
    }

    if ($normal.Contains("30%")) {
      $afterColon = if ($linha.Contains(":")) { ($linha -split ":", 2)[1] } else { $linha }
      $valorClinica = Parse-ExpressionAmount $afterColon
      if ($null -ne $profissionalPendente -and $pacienteAtual -and $especialidadeAtual) {
        $total = if ($null -ne $totalPendente) { $totalPendente } else { [math]::Round($profissionalPendente + $valorClinica, 2) }
        $key = "$(Normalize-Text $pacienteAtual)|$(Normalize-Text $convenioAtual)|$(Normalize-Text $especialidadeAtual)"
        if ($seen.Add($key)) {
          $records.Add([pscustomobject][ordered]@{
            paciente_id = $null
            paciente_nome = $pacienteAtual
            convenio_id = $null
            convenio_nome = $convenioAtual
            especialidade_id = $null
            especialidade_nome = $especialidadeAtual
            valor_plano = $total
            valor_profissional = $profissionalPendente
            percentual_clinica = if ($total -gt 0) { [math]::Round(($valorClinica / $total) * 100, 2) } else { 0 }
            percentual_profissional = if ($total -gt 0) { [math]::Round(($profissionalPendente / $total) * 100, 2) } else { 0 }
            tipo_calculo = "fixo"
            valor_fixo = $true
            status = "ativo"
            observacoes = "Importado do arquivo LISTA DE PACIENTES E VALORES.docx. Valores conforme documento original (plano/profissional/clinica)."
            inconsistencias = @()
            origem_importacao = "docx_lista_pacientes_valores"
          })
        }
      }
      $totalPendente = $null
      $profissionalPendente = $null
      continue
    }

    if ($moneyMatches.Count -gt 0) {
      $parts = $linha -split "\|"
      $possiblePatient = ($parts | Where-Object { (Normalize-Text $_) -notmatch "VALOR|PLANO|CONVENIO|ESPECIALIDADE|70%|30%" -and $_ -notmatch "\d{2,3}(?:[,.]\d{1,3})?" } | Select-Object -First 1)
      if ($possiblePatient) { $pacienteAtual = $possiblePatient.Trim('" ').Trim() }
      if (-not $especialidadeAtual -and $foundEspecialidades.Count) {
        $especialidadeAtual = (($foundEspecialidades | Select-Object -Unique) -join " ")
      }
      if (-not $convenioAtual) { $convenioAtual = "Particular/Plano nao informado" }

      foreach ($match in $moneyMatches) {
        $valor = Parse-Money $match.Value
        if ($valor -le 0 -or -not $pacienteAtual -or -not $especialidadeAtual) { continue }
        $key = "$(Normalize-Text $pacienteAtual)|$(Normalize-Text $convenioAtual)|$(Normalize-Text $especialidadeAtual)"
        if (-not $seen.Add($key)) { continue }
        $records.Add([pscustomobject][ordered]@{
          paciente_id = $null
          paciente_nome = $pacienteAtual
          convenio_id = $null
          convenio_nome = $convenioAtual
          especialidade_id = $null
          especialidade_nome = $especialidadeAtual
          valor_plano = $valor
          valor_profissional = $valor
          percentual_clinica = 0
          percentual_profissional = 100
          tipo_calculo = "fixo"
          valor_fixo = $true
          status = "ativo"
          observacoes = "Importado do arquivo LISTA DE PACIENTES E VALORES.docx. Defina o valor da clinica manualmente."
          inconsistencias = @()
          origem_importacao = "docx_lista_pacientes_valores"
        })
      }
      continue
    }

    if (-not $normal.Contains("NOME DO PACIENTE") -and -not $normal.Contains("PLANO") -and $normal.Length -gt 2) {
      $pacienteAtual = $linha.Trim('" ').Trim()
    }
  }

  return $records
}

$supabaseUrl = Read-EnvValue "NEXT_PUBLIC_SUPABASE_URL"
$supabaseKey = Read-EnvValue "NEXT_PUBLIC_SUPABASE_ANON_KEY"
$headers = @{
  apikey = $supabaseKey
  Authorization = "Bearer $supabaseKey"
  "Content-Type" = "application/json"
  Prefer = "return=representation"
}

$lines = Extract-DocxText $DocxPath
$records = Convert-ToTabelaValores $lines
if ($records.Count -eq 0) { throw "Nenhum registro reconhecido no DOCX." }

$existing = Invoke-RestMethod -Method Get -Uri "$supabaseUrl/rest/v1/tabela_valores?select=id,paciente_nome,convenio_nome,especialidade_nome,status" -Headers $headers
$existingKeys = New-Object Collections.Generic.HashSet[string]
foreach ($row in $existing) {
  if ($row.status -eq "ativo") {
    [void]$existingKeys.Add("$(Normalize-Text $row.paciente_nome)|$(Normalize-Text $row.convenio_nome)|$(Normalize-Text $row.especialidade_nome)")
  }
}

$toInsert = @()
foreach ($record in $records) {
  $key = "$(Normalize-Text $record.paciente_nome)|$(Normalize-Text $record.convenio_nome)|$(Normalize-Text $record.especialidade_nome)"
  if ($existingKeys.Add($key)) { $toInsert += $record }
}

if ($toInsert.Count -gt 0) {
  $json = ConvertTo-Json -InputObject @($toInsert) -Depth 8 -Compress
  $inserted = Invoke-RestMethod -Method Post -Uri "$supabaseUrl/rest/v1/tabela_valores" -Headers $headers -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes($json))
  $insertedCount = @($inserted).Count
} else {
  $insertedCount = 0
}

[pscustomobject]@{
  docx_linhas = $lines.Count
  reconhecidos = $records.Count
  ja_existiam = $records.Count - $toInsert.Count
  inseridos_no_supabase = $insertedCount
}
