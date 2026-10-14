# LinkPortal

Ürün bağlantılarını ve bir ürüne ait birden fazla hesabı yönetmek için Türkçe kişisel portal.

## Çalıştırma

Node.js 20 veya üzeri gerekir. Harici paket veya kurulum gerekmez.

```powershell
npm start
```

Tarayıcıda http://localhost:5186 adresini aç. İlk açılışta en az 12 karakterlik bir ana parola belirle. Örnek ürün linklerini değiştirebilir veya silebilirsin; örnek hesap/şifre bulunmaz.

## Docker Compose ile çalıştırma

Docker ve Docker Compose kuruluysa proje dizininde:

```sh
docker compose up -d --build
```

Portal hem http://localhost:1010 hem de http://localhost:1011 adresinden açılır. İki port da aynı uygulamaya yönlenir; container içindeki port 5186 olarak kalır. Portları değiştirmek için PowerShell örneği:

```powershell
$env:LINKPORTAL_PORT = '1012'
$env:LINKPORTAL_ALT_PORT = '1013'
docker compose up -d --build
```

Bu durumda adresler http://localhost:1012 ve http://localhost:1013 olur. Kasa tarayıcıda adres ve porta bağlı tutulduğu için farklı porttaki veriler otomatik görünmez; şifreli yedek ile aktarabilirsin. Düzenli kullanım için tek bir adres seç.

```sh
docker compose logs -f
docker compose down
```

Container yalnızca uygulama dosyalarını sunar; kasa tarayıcıda saklandığı için volume gerekmez. Container'ı kaldırmak tarayıcıdaki kasayı silmez. Container içinde sunucu `0.0.0.0` dinler; Compose portu bilgisayarın yalnızca `127.0.0.1` adresine açar.

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

Yerel sunucu varsayılan olarak 127.0.0.1 üzerinde statik uygulama dosyalarını sunar; dinleme adresi `HOST` ortam değişkeniyle ayarlanabilir. Şifreleri veya ana parolayı almaz. İnternete açılacaksa HTTPS gerekir. Aynı tarayıcıda iki sekme açıksa diğer sekmede kayıt değiştiğinde kasa yeniden kilitlenir.

## Doğrulama

```powershell
npm test
```

Şifreli kasa döngüsü, yanlış parola, veri değişikliğinin tespiti, geçersiz yedek içeriği ve URL protokolleri sınanır.
