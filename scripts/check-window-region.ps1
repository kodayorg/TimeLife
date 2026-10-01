param([long]$Handle,[switch]$NativeCorners)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RegionCheck {
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;}
 [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h,int attribute,out int value,int size);
 [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr h,IntPtr r);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int l,int t,int r,int b);
 [DllImport("gdi32.dll")] public static extern int GetRgnBox(IntPtr r,out Rect bounds);
 [DllImport("gdi32.dll")] public static extern bool PtInRegion(IntPtr r,int x,int y);
 [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr r);
}
"@
if($NativeCorners) {
 $corner=0;$material=0
 [void][RegionCheck]::DwmGetWindowAttribute([IntPtr]$Handle,33,[ref]$corner,4)
 [void][RegionCheck]::DwmGetWindowAttribute([IntPtr]$Handle,38,[ref]$material,4)
 if($corner -ne 2 -or $material -ne 3) {throw 'Native Acrylic or rounded DWM corners missing'}
 Write-Output 'DWM rounded Acrylic verified'
 return
}
$region=[RegionCheck]::CreateRectRgn(0,0,0,0)
try {
 $result=[RegionCheck]::GetWindowRgn([IntPtr]$Handle,$region)
 if ($result -eq 0) {throw 'Native region missing'}
 $rect=New-Object RegionCheck+Rect
 [void][RegionCheck]::GetWindowRect([IntPtr]$Handle,[ref]$rect)
 $w=$rect.Right-$rect.Left;$h=$rect.Bottom-$rect.Top
 foreach($point in @(@(0,0),@(($w-1),0),@(0,($h-1)),@(($w-1),($h-1)))) {
  if([RegionCheck]::PtInRegion($region,$point[0],$point[1])) {throw 'Square corner remains in native region'}
 }
 if(-not [RegionCheck]::PtInRegion($region,[int]($w/2),[int]($h/2))) {throw 'Window center clipped'}
 if(-not [RegionCheck]::PtInRegion($region,[int]($w/2),1)) {throw 'Top edge clipped'}
 $clip=New-Object RegionCheck+Rect
 [void][RegionCheck]::GetRgnBox($region,[ref]$clip)
 Write-Output ('Native rounded region verified: '+($clip.Right-$clip.Left)+'x'+($clip.Bottom-$clip.Top))
} finally { [void][RegionCheck]::DeleteObject($region) }
