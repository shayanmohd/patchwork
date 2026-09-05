# JS bridge: the WebView calls these by name via reflection.
-keepclassmembers class com.mohdshayan.patchwork.MainActivity$Native { public *; }
-keep class com.mohdshayan.patchwork.MainActivity$Native { *; }
