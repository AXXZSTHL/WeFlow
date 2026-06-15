param(
  [Parameter(Mandatory = $true)]
  [string]$TargetsJson,
  [Parameter(Mandatory = $true)]
  [string]$Message,
  [Parameter(Mandatory = $false)]
  [string]$AutoSend = 'true'
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

function New-Result {
  param(
    [bool]$Success,
    [string]$Error,
    [string]$TargetUsed,
    [bool]$Sent,
    [bool]$Opened
  )

  $result = [ordered]@{
    success = $Success
  }

  if ($Error) { $result.error = $Error }
  if ($TargetUsed) { $result.targetUsed = $TargetUsed }
  if ($Sent) { $result.sent = $Sent }
  if ($Opened) { $result.opened = $Opened }

  return $result
}

function Get-WeChatWindow {
  $processes = Get-Process -Name Weixin, WeChat -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 }

  foreach ($process in $processes) {
    try {
      $element = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$process.MainWindowHandle)
      if ($element) {
        return $element
      }
    } catch {
      continue
    }
  }

  return $null
}

function Get-EditableControls {
  param([System.Windows.Automation.AutomationElement]$Root)

  $items = New-Object System.Collections.Generic.List[object]
  $all = $Root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)

  for ($index = 0; $index -lt $all.Count; $index++) {
    $element = $all.Item($index)
    try {
      if (-not $element.Current.IsEnabled) { continue }
      $controlType = $element.Current.ControlType
      if ($controlType -eq [System.Windows.Automation.ControlType]::Edit -or $controlType -eq [System.Windows.Automation.ControlType]::ComboBox) {
        $items.Add($element) | Out-Null
      }
    } catch {
      continue
    }
  }

  return $items
}

function Set-Value {
  param(
    [System.Windows.Automation.AutomationElement]$Element,
    [string]$Text
  )

  $pattern = $null
  if ($Element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) {
    try {
      $pattern.SetValue($Text)
      return $true
    } catch {
      return $false
    }
  }

  return $false
}

function Press-Enter {
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
}

try {
  $decodedTargets = $null
  if (-not [string]::IsNullOrWhiteSpace($TargetsJson)) {
    $decodedTargets = ConvertFrom-Json -InputObject $TargetsJson
  }

  $targets = @()
  if ($null -ne $decodedTargets) {
    if ($decodedTargets -is [string]) {
      $targets = @([string]$decodedTargets)
    } elseif ($decodedTargets -is [System.Array]) {
      $targets = @($decodedTargets | ForEach-Object { [string]$_ })
    } else {
      $targets = @([string]$decodedTargets)
    }
  }

  $targets = @($targets | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $messageValue = [string]$Message
  $autoSendEnabled = $true
  if (-not [string]::IsNullOrWhiteSpace($AutoSend)) {
    $autoSendEnabled = @('1', 'true', '$true', 'yes', 'on') -contains $AutoSend.ToLowerInvariant()
  }

  if ([string]::IsNullOrWhiteSpace($messageValue)) {
    $result = New-Result -Success $false -Error 'EMPTY_MESSAGE' -TargetUsed $null -Sent $false -Opened $false
    $result | ConvertTo-Json -Compress
    exit 0
  }

  if ($targets.Count -eq 0) {
    $result = New-Result -Success $false -Error 'NO_TARGETS' -TargetUsed $null -Sent $false -Opened $false
    $result | ConvertTo-Json -Compress
    exit 0
  }

  $window = Get-WeChatWindow
  if (-not $window) {
    $result = New-Result -Success $false -Error 'NO_WINDOW' -TargetUsed $null -Sent $false -Opened $false
    $result | ConvertTo-Json -Compress
    exit 0
  }

  $targetUsed = $targets[0]
  $searchOk = $false

  foreach ($candidate in ($targets | Select-Object -First 6)) {
    $controls = Get-EditableControls -Root $window
    if ($controls.Count -lt 1) {
      break
    }

    $searchControl = $controls[0]
    if (-not (Set-Value -Element $searchControl -Text $candidate)) {
      continue
    }

    try { $searchControl.SetFocus() } catch { }
    Start-Sleep -Milliseconds 120
    Press-Enter
    Start-Sleep -Milliseconds 900

    $openedTitle = [string]$window.Current.Name
    $openedMatches = $false
    foreach ($needle in $targets) {
      if (-not [string]::IsNullOrWhiteSpace($openedTitle) -and $openedTitle.Contains($needle)) {
        $openedMatches = $true
        break
      }
    }

    if (-not $openedMatches) {
      continue
    }

    $targetUsed = $candidate
    $searchOk = $true
    break
  }

  if (-not $searchOk) {
    $result = New-Result -Success $false -Error 'TARGET_NOT_FOUND' -TargetUsed $null -Sent $false -Opened $false
    $result | ConvertTo-Json -Compress
    exit 0
  }

  $controlsAfter = Get-EditableControls -Root $window
  if ($controlsAfter.Count -lt 1) {
    $result = New-Result -Success $false -Error 'COMPOSER_NOT_FOUND' -TargetUsed $targetUsed -Sent $false -Opened $true
    $result | ConvertTo-Json -Compress
    exit 0
  }

  $composer = $controlsAfter[$controlsAfter.Count - 1]
  if (-not (Set-Value -Element $composer -Text $messageValue)) {
    $result = New-Result -Success $false -Error 'COMPOSER_SET_FAILED' -TargetUsed $targetUsed -Sent $false -Opened $true
    $result | ConvertTo-Json -Compress
    exit 0
  }

  try { $composer.SetFocus() } catch { }

  if ($autoSendEnabled) {
    Start-Sleep -Milliseconds 120
    Press-Enter
  }

  $result = New-Result -Success $true -Error $null -TargetUsed $targetUsed -Sent $autoSendEnabled -Opened $true
  $result | ConvertTo-Json -Compress
  exit 0
} catch {
  $result = New-Result -Success $false -Error $_.Exception.Message -TargetUsed $null -Sent $false -Opened $false
  $result | ConvertTo-Json -Compress
  exit 0
}
