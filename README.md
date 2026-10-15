# LinkPortal

Ürün bağlantılarını ve bir ürüne ait birden fazla hesabı yönetmek için Türkçe kişisel portal.

## Çalıştırma

Node.js 20 veya üzeri gerekir. Harici paket veya kurulum gerekmez.

```powershell
npm start
```

Tarayıcıda http://localhost:5186 adresini aç. İlk açılışta en az 6 karakterlik bir ana parola belirle. Örnek ürün linklerini değiştirebilir veya silebilirsin; örnek hesap/şifre bulunmaz.

## Docker Compose ile çalıştırma

Docker ve Docker Compose kuruluysa proje dizininde:

```sh
docker compose up -d --build
```

Portal http://localhost:1010 adresinden açılır. Container içindeki port 5186 olarak kalır. Dış portu değiştirmek için PowerShell örneği:

```powershell
$env:LINKPORTAL_PORT = '1012'
docker compose up -d --build
```

Bu durumda adres http://localhost:1012 olur. Kasa tarayıcıda adres ve porta bağlı tutulduğu için farklı porttaki veriler otomatik görünmez; şifreli yedek ile aktarabilirsin.

```sh
docker compose logs -f
docker compose down
```

Container yalnızca uygulama dosyalarını sunar; kasa tarayıcıda saklandığı için volume gerekmez. Container'ı kaldırmak tarayıcıdaki kasayı silmez. Container içinde sunucu `0.0.0.0` dinler; Compose portu bilgisayarın yalnızca `127.0.0.1` adresine açar.

## Özellikler

- Ürün ve bağlantı ekleme, düzenleme, silme
- Her ürün için kullanıcı adı ve görünür şifreden oluşan hesap satırları; yazdıkça otomatik yeni satır
- Şifre gizleme/gösterme, ürün bağlantısı ve tüm hesap bilgilerini tek seferde kopyalama
- Favoriler, kategoriler, arama ve sıralama
- Ana parolayla açılan AES-256-GCM kasa; PBKDF2-SHA256 ile 600.000 iterasyon
- Rastgele salt ve her kayıtta yeni IV; yalnızca şifreli veri localStorage'a yazılır
- Beş dakika hareketsizlikte otomatik kilit
- Şifreli JSON yedek indirme ve parola doğrulamalı geri yükleme
- Ayrı parolayla şifrelenmiş kasa kopyasını bağlantıyla paylaşma
- Mobil uyumlu, dış servis veya izleme içermeyen arayüz

## Hesap ekleme ve toplu kopyalama

Ürün düzenleyicisinde yalnızca kullanıcı adı ve şifre girilir. Şifreler başlangıçta görünürdür; göz düğmesiyle gizleyebilirsin. Son satıra yazınca altta yeni boş satır açılır. Tamamen boş satırlar kaydedilmez; doldurmaya başladığın satırın hem kullanıcı adını hem şifresini tamamlamalısın. Eski kasalar ve yedekler uyumludur.

**Tümünü kopyala**, ürün bağlantısıyla birlikte ürünün bütün kullanıcı adı ve şifrelerini panoya düz metin olarak kopyalar. Bu seçenek ürün düzenleyicisinde, hesap ayrıntılarında ve ürün listesindeki kopyala düğmesinde bulunur.

## Kasayı bağlantıyla paylaşma

Kasanı açıp **Kasayı bağlantıyla paylaş** düğmesine bas ve paylaşacağın ürünleri veya hesapları tek tek seç. **Tümünü seç** ile tüm kasayı seçebilirsin. **Seçilenlerin link ve hesap bilgilerini kopyala** düğmesi seçtiğin kayıtları düz metin olarak kopyalar. Şifreli bağlantı için ana parolandan farklı, en az 6 karakterlik bir paylaşım parolası belirle, bağlantıyı oluştur ve kopyala. Alıcıya parolayı ayrı ilet. Diğer cihazların erişebilmesi için bağlantıyı portalın herkese açık HTTPS adresinde oluştur; localhost bağlantıları diğer cihazlarda çalışmaz.

Bağlantı yalnızca seçilen ürün ve hesapların o andaki bağımsız kopyasını içerir. Seçilmeyen hesaplar şifrelenen içeriğe dahil edilmez. Veri, yeni salt ve IV ile AES-256-GCM kullanılarak tarayıcıda şifrelenir. Şifreli içerik URL'nin `#share=` bölümündedir; HTTP isteğinde sunucuya gönderilmez. Açılışta bu bölüm adres çubuğundan temizlenir. Paylaşım parolası bağlantıya eklenmez. Bağlantı ve parola birlikte tüm kopyaya erişim sağlar; paylaşım süresizdir ve iptal edilemez. Sonraki düzenlemeler kopyaya yansımaz.

Alıcı paylaşım parolasını girerek kopyayı kendi tarayıcısına kaydeder ve daha sonra aynı parolayla açar. Mevcut kasa varsa, doğru parola doğrulandıktan sonra değiştirme onayı istenir. **Vazgeç, kendi kasama dön** ile mevcut kasa korunur. Bağlantılar en fazla 64.000 karakter olabilir; büyük kasalarda şifreli JSON yedeğini paylaş. Bazı mesajlaşma uygulamaları daha kısa bağlantı sınırları uygulayabilir.

## Verilerin saklanması

Kasa yalnızca kullanılan tarayıcının bu adresine ait yerel depolamasında tutulur. Cihazlar/tarayıcılar arasında otomatik eşitlenmez. Tarayıcı verileri silinirse kasa da silinir; düzenli olarak **Şifreli yedek indir** ile yedek al. Ana parola kaybolursa kurtarılamaz. Panoya kopyalanan bilgiler sistem panosunda kalabilir. Bu uygulama bağımsız güvenlik denetiminden geçmemiştir.

Yerel sunucu varsayılan olarak 127.0.0.1 üzerinde statik uygulama dosyalarını sunar; dinleme adresi `HOST` ortam değişkeniyle ayarlanabilir. Şifreleri veya ana parolayı almaz. İnternete açılacaksa HTTPS gerekir. Aynı tarayıcıda iki sekme açıksa diğer sekmede kayıt değiştiğinde kasa yeniden kilitlenir.

## Doğrulama

```powershell
npm test
```

Şifreli kasa döngüsü, yanlış parola, veri değişikliğinin tespiti, geçersiz yedek içeriği ve URL protokolleri sınanır.
