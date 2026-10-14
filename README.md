# LinkPortal

Ürün bağlantılarını ve bir ürüne ait birden fazla hesabı yönetmek için Türkçe kişisel portal.

## Çalıştırma

Node.js 20 veya üzeri gerekir. Harici paket veya kurulum gerekmez.

```powershell
npm start
```

Tarayıcıda http://localhost:5186 adresini aç. İlk açılışta en az 12 karakterlik bir ana parola belirle. Örnek ürün linklerini değiştirebilir veya silebilirsin; örnek hesap/şifre bulunmaz.

## Özellikler

- Ürün ve bağlantı ekleme, düzenleme, silme
- Her ürün için birden fazla etiketli kullanıcı adı ve şifre
- Şifre gizleme/gösterme ve panoya kopyalama
- Favoriler, kategoriler, arama ve sıralama
- Ana parolayla açılan AES-256-GCM kasa; PBKDF2-SHA256 ile 600.000 iterasyon
- Rastgele salt ve her kayıtta yeni IV; yalnızca şifreli veri localStorage'a yazılır
- Beş dakika hareketsizlikte otomatik kilit
- Şifreli JSON yedek indirme ve parola doğrulamalı geri yükleme
- Mobil uyumlu, dış servis veya izleme içermeyen arayüz

## Verilerin saklanması

Kasa yalnızca kullanılan tarayıcının bu adresine ait yerel depolamasında tutulur. Cihazlar/tarayıcılar arasında otomatik eşitlenmez. Tarayıcı verileri silinirse kasa da silinir; düzenli olarak **Şifreli yedek indir** ile yedek al. Ana parola kaybolursa kurtarılamaz. Panoya kopyalanan bilgiler sistem panosunda kalabilir. Bu uygulama bağımsız güvenlik denetiminden geçmemiştir.

Sunucu yalnızca 127.0.0.1 üzerinde statik uygulama dosyalarını sunar; şifreleri veya ana parolayı almaz. İnternete açılacaksa HTTPS gerekir. Aynı tarayıcıda iki sekme açıksa diğer sekmede kayıt değiştiğinde kasa yeniden kilitlenir.

## Doğrulama

```powershell
npm test
```

Şifreli kasa döngüsü, yanlış parola, veri değişikliğinin tespiti, geçersiz yedek içeriği ve URL protokolleri sınanır.
