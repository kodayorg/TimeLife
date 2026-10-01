param([long]$Handle,[string]$OutputPath)
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class CaptureRect {
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
}
"@
$rect=New-Object CaptureRect+Rect
[void][CaptureRect]::GetWindowRect([IntPtr]$Handle,[ref]$rect)
$bitmap=New-Object System.Drawing.Bitmap(($rect.Right-$rect.Left),($rect.Bottom-$rect.Top))
$graphics=[System.Drawing.Graphics]::FromImage($bitmap)
try { $graphics.CopyFromScreen($rect.Left,$rect.Top,0,0,$bitmap.Size);$bitmap.Save($OutputPath); Write-Output "$($bitmap.GetPixel(0,0)) $($bitmap.GetPixel(8,8))" } finally {$graphics.Dispose();$bitmap.Dispose()}
