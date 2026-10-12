// Quita fondo negro: píxeles oscuros → transparentes, recorta sobrantes.
// Uso: compilar con Add-Type y llamar [LogoBg]::QuitarNegro(in, out)
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class LogoBg {
  public static void QuitarNegro(string entrada, string salida) {
    int T0 = 10;  // bajo esto = 100% transparente
    int T1 = 36;  // sobre esto = 100% opaco (banda intermedia = fundido)
    using (var orig = new Bitmap(entrada))
    using (var bmp = new Bitmap(orig.Width, orig.Height, PixelFormat.Format32bppArgb)) {
      using (var g = Graphics.FromImage(bmp)) { g.DrawImage(orig, 0, 0); }
      var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
      var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      int n = data.Stride * data.Height;
      byte[] px = new byte[n];
      Marshal.Copy(data.Scan0, px, 0, n);
      int minX = bmp.Width, minY = bmp.Height, maxX = -1, maxY = -1;
      for (int y = 0; y < bmp.Height; y++) {
        for (int x = 0; x < bmp.Width; x++) {
          int i = y * data.Stride + x * 4;
          int b = px[i], gg = px[i + 1], r = px[i + 2];
          int v = Math.Max(r, Math.Max(gg, b));
          int a = v <= T0 ? 0 : (v >= T1 ? 255 : (v - T0) * 255 / (T1 - T0));
          if (a > 0) {
            // "des-multiplica" para no dejar halo oscuro en los bordes
            px[i]     = (byte)Math.Min(255, b * 255 / Math.Max(a, 1));
            px[i + 1] = (byte)Math.Min(255, gg * 255 / Math.Max(a, 1));
            px[i + 2] = (byte)Math.Min(255, r * 255 / Math.Max(a, 1));
            px[i + 3] = (byte)a;
            if (a > 8) {
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
          } else {
            px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
          }
        }
      }
      Marshal.Copy(px, 0, data.Scan0, n);
      bmp.UnlockBits(data);
      Bitmap final = bmp;
      if (maxX >= 0) { // recorta el aire negro sobrante (+4px de margen)
        int pad = 4;
        int x0 = Math.Max(0, minX - pad), y0 = Math.Max(0, minY - pad);
        int w = Math.Min(bmp.Width - x0, maxX - minX + pad * 2 + 1);
        int h = Math.Min(bmp.Height - y0, maxY - minY + pad * 2 + 1);
        final = bmp.Clone(new Rectangle(x0, y0, w, h), PixelFormat.Format32bppArgb);
      }
      final.Save(salida, ImageFormat.Png);
      if (final != bmp) final.Dispose();
      Console.WriteLine("OK " + final.Width + "x" + final.Height + " -> " + salida);
    }
  }
}
