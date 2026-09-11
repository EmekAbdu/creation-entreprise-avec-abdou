(function(){
"use strict";

/* ============================ i18n ============================ */
var LANG = (localStorage.getItem("cr_lang") || "fr");
function t(o){ if(o==null) return ""; if(typeof o==="string") return o; return o[LANG]!=null?o[LANG]:(o.fr||""); }

var S = {
  next:{fr:"Suivant",tr:"İleri"}, prev:{fr:"Précédent",tr:"Geri"},
  finish:{fr:"Terminer et générer le dossier",tr:"Bitir ve dosyayı oluştur"},
  required:{fr:"Champ obligatoire",tr:"Zorunlu alan"},
  fixErrors:{fr:"Complétez les champs en rouge avant de continuer.",tr:"Devam etmeden önce kırmızı alanları doldurun."},
  saved:{fr:"Brouillon enregistré sur cet appareil",tr:"Taslak bu cihaza kaydedildi"},
  photo:{fr:"Prendre / choisir",tr:"Fotoğraf çek / seç"},
  rephoto:{fr:"Remplacer",tr:"Değiştir"},
  del:{fr:"Supprimer",tr:"Sil"},
  noPhoto:{fr:"Aucune photo",tr:"Fotoğraf yok"},
  addAssoc:{fr:"+ Ajouter un associé",tr:"+ Ortak ekle"},
  remove:{fr:"Retirer",tr:"Kaldır"},
  yes:{fr:"Oui",tr:"Evet"}, no:{fr:"Non",tr:"Hayır"},
  chars:{fr:"caractères",tr:"karakter"},
  locked:{fr:"Section verrouillée — cochez l’autorisation ci-dessus.",tr:"Bölüm kilitli — yukarıdaki izni işaretleyin."},
  choose:{fr:"— Choisir —",tr:"— Seçiniz —"},
  ofWhich:{fr:"dont",tr:"bunun"},
  gerant:{fr:"Gérant",tr:"Müdür (Gérant)"},
  president:{fr:"Président",tr:"Başkan (Président)"},
  dirigeant:{fr:"dirigeant",tr:"yönetici"},
  send:{fr:"Envoyer mon dossier à Comptarapide",tr:"Dosyamı Comptarapide'e gönder"},
  sending:{fr:"Envoi en cours…",tr:"Gönderiliyor…"},
  sendPhotos:{fr:"Envoi des photos",tr:"Fotoğraflar gönderiliyor"},
  sentOK:{fr:"Dossier reçu",tr:"Dosya alındı"},
  zipBackup:{fr:"Télécharger une copie (.zip)",tr:"Bir kopya indir (.zip)"},
  home:{fr:"Accueil",tr:"Ana sayfa"}
};

/* ============================ state ============================ */
var D = { meta:{v:3, started:new Date().toISOString()}, ans:{}, people:[], docs:{} };
var VIEW = "home";   // "home" = page de présentation, "form" = parcours en 9 étapes
var PHOTOS = {};          // key -> {dataUrl, name, bytes}
var stepIdx = 0, maxStep = 0;

/* ============================ helpers ============================ */
function el(tag, cls, txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function toast(msg){ var e=$("toast"); e.textContent=msg; e.classList.add("on"); clearTimeout(e._t); e._t=setTimeout(function(){e.classList.remove("on");},2600); }
function isSAS(){ var f=D.ans.forme||""; return f==="SAS"||f==="SASU"; }
function chief(){ return isSAS()? t(S.president) : t(S.gerant); }
function soloForm(){ var f=D.ans.forme||""; return f==="SASU"||f==="EURL"; }
function slug(s){ return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,40) || "dossier"; }
function uuid(){
  if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){
    var r=Math.random()*16|0, v=c==="x"?r:((r&0x3)|0x8); return v.toString(16);
  });
}
function dataUrlToBlob(u){
  var parts=u.split(","), mime=(parts[0].match(/:(.*?);/)||[])[1]||"image/jpeg";
  var bin=atob(parts[1]), n=bin.length, arr=new Uint8Array(n);
  while(n--) arr[n]=bin.charCodeAt(n);
  return new Blob([arr],{type:mime});
}
function makeRef(){
  var d=new Date();
  var p=String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
  var r=Math.random().toString(36).slice(2,6).toUpperCase();
  return "CR-"+p+"-"+r;
}
function todayFR(){ var d=new Date(); return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear(); }


/* ====================== page d'accueil ====================== */
var H = {
  kicker:{fr:"Création de société · France",tr:"Şirket kuruluşu · Fransa"},
  h1:{fr:"Votre société créée dans les règles, sans que vous ayez à comprendre les formalités.",
      tr:"Şirketiniz kurallara uygun biçimde kurulsun; formaliteleri anlamak zorunda kalmadan."},
  lede:{fr:"Je m’appelle Abdou et je monte des dossiers de création d’entreprise depuis le cabinet COMPTARAPIDE, à Nemours. Vous répondez à un questionnaire, vous photographiez vos pièces, et <b>je m’occupe du reste</b> : statuts, annonce légale, dépôt de capital, guichet unique INPI, jusqu’à votre extrait Kbis.",
        tr:"Adım Abdou. Nemours’daki COMPTARAPIDE bürosunda şirket kuruluş dosyaları hazırlıyorum. Siz bir formu doldurur, belgelerinizi fotoğraflarsınız; <b>gerisini ben hallederim</b>: ana sözleşme, resmî ilan, sermaye yatırımı, INPI tek pencere ve Kbis belgeniz."},
  start:{fr:"Commencer mon dossier",tr:"Dosyamı başlatmak istiyorum"},
  resume:{fr:"Reprendre mon dossier",tr:"Dosyama devam et"},
  callme:{fr:"Appelez-moi, on le remplit ensemble",tr:"Beni arayın, birlikte dolduralım"},
  meta1:{fr:"Environ 15 minutes",tr:"Yaklaşık 15 dakika"},
  meta2:{fr:"En français ou en turc",tr:"Fransızca veya Türkçe"},
  meta3:{fr:"Vos réponses restent sur votre téléphone tant que vous n’envoyez pas",tr:"Göndermediğiniz sürece cevaplarınız telefonunuzda kalır"},

  incH:{fr:"Ce que je prends en charge",tr:"Neleri üstleniyorum"},
  incS:{fr:"Vous ne rédigez rien, vous ne remplissez aucun formulaire administratif et vous ne vous présentez devant aucun guichet.",
        tr:"Hiçbir metin yazmaz, hiçbir resmî form doldurmaz ve hiçbir gişeye gitmezsiniz."},
  inc:[
    {t:{fr:"Les statuts",tr:"Ana sözleşme"},d:{fr:"Rédigés sur mesure selon la forme choisie — EURL, SARL, SASU ou SAS — et adaptés à votre activité réelle.",tr:"Seçtiğiniz biçime göre — EURL, SARL, SASU veya SAS — size özel hazırlanır ve gerçek faaliyetinize uyarlanır."}},
    {t:{fr:"Le prévisionnel pour la banque",tr:"Banka için öngörü tablosu"},d:{fr:"Si votre banque en demande un pour ouvrir le compte de dépôt de capital, je vous le prépare.",tr:"Bankanız sermaye hesabı açmak için isterse, sizin için hazırlarım."}},
    {t:{fr:"L’annonce légale",tr:"Resmî ilan"},d:{fr:"Rédigée et publiée dans un journal habilité de votre département, avec l’attestation de parution.",tr:"İlinizde yetkili bir gazetede yazılır, yayımlanır ve yayın belgesi alınır."}},
    {t:{fr:"Les déclarations obligatoires",tr:"Zorunlu beyanlar"},d:{fr:"Déclaration de non-condamnation, filiation, et déclaration des bénéficiaires effectifs — trois pièces qui font rejeter la moitié des dossiers.",tr:"Sabıkasızlık beyanı, soybağı ve gerçek faydalanıcı beyanı — dosyaların yarısını reddettiren üç belge."}},
    {t:{fr:"Le dépôt au guichet unique",tr:"Tek pencereye başvuru"},d:{fr:"Le dossier complet déposé à l’INPI, et le suivi jusqu’à l’obtention du SIREN et du Kbis.",tr:"Tam dosya INPI’ye sunulur; SIREN ve Kbis alınana kadar takip edilir."}},
    {t:{fr:"La cohérence de l’ensemble",tr:"Bütünün tutarlılığı"},d:{fr:"Une seule différence d’orthographe entre les statuts, l’annonce et la pièce d’identité suffit à faire rejeter le dossier. Je vérifie.",tr:"Ana sözleşme, ilan ve kimlik arasındaki tek bir yazım farkı dosyayı reddettirir. Ben kontrol ederim."}}
  ],

  helpH:{fr:"Vous n’êtes pas seul devant ce formulaire",tr:"Bu formun karşısında yalnız değilsiniz"},
  helpS:{fr:"C’est le point sur lequel je veux être clair : ce questionnaire n’est pas un mur. Il existe pour aller vite quand vous êtes à l’aise, pas pour vous laisser bloqué.",
         tr:"Net olmak istediğim nokta şu: bu form bir duvar değildir. Rahat olduğunuzda hızlı ilerlemek içindir, sizi tıkamak için değil."},
  help1t:{fr:"Pendant que vous remplissez",tr:"Siz doldururken"},
  help1d:{fr:"Une question sur l’objet social, le capital, le régime de TVA, ou simplement sur ce qu’on attend de vous dans une case ? Écrivez-moi sur WhatsApp, je réponds et vous continuez. Vous pouvez aussi fermer la page et reprendre plus tard : votre brouillon reste enregistré sur votre appareil.",
          tr:"Faaliyet konusu, sermaye, KDV rejimi ya da bir alanda sizden ne istendiği hakkında bir soru mu var? WhatsApp’tan yazın, cevaplayayım, siz devam edin. Sayfayı kapatıp sonra da dönebilirsiniz: taslağınız cihazınızda saklanır."},
  help2t:{fr:"Ou je le remplis à votre place",tr:"Ya da sizin yerinize ben doldururum"},
  help2d:{fr:"Si vous préférez ne pas le faire vous-même — parce que vous n’êtes pas à l’aise avec l’écrit, avec le français administratif, ou simplement parce que vous n’avez pas le temps — appelez-moi. On le remplit ensemble au téléphone, ou vous m’envoyez vos pièces et je m’en charge entièrement. Cela ne coûte pas plus cher.",
          tr:"Kendiniz yapmak istemiyorsanız — yazışmakta veya resmî Fransızcada zorlanıyorsanız ya da vaktiniz yoksa — beni arayın. Telefonda birlikte doldururuz veya belgelerinizi bana gönderirsiniz, tamamını ben üstlenirim. Bu ek ücrete tabi değildir."},
  help1tag:{fr:"Assistance",tr:"Destek"},
  help2tag:{fr:"Prise en charge complète",tr:"Tam hizmet"},
  waBtn:{fr:"Écrire sur WhatsApp",tr:"WhatsApp’tan yazın"},

  flowH:{fr:"Comment ça se passe",tr:"Süreç nasıl işler"},
  flow:[
    {t:{fr:"Vous remplissez le questionnaire",tr:"Formu doldurursunuz"},
     d:{fr:"Neuf étapes : la société, vous, les associés éventuels, la fiscalité, puis les photos de vos pièces. Comptez un quart d’heure si vos documents sont à portée de main.",tr:"Dokuz adım: şirket, siz, varsa ortaklar, vergi tercihleri ve belgelerinizin fotoğrafları. Belgeleriniz elinizin altındaysa yaklaşık on beş dakika."},
     who:{fr:"Vous",tr:"Siz"}, moi:false},
    {t:{fr:"Je rédige les statuts",tr:"Ana sözleşmeyi hazırlarım"},
     d:{fr:"Dès réception du premier versement, je vous envoie les statuts et, si vous l’avez demandé, le prévisionnel pour la banque.",tr:"İlk ödeme alındığında ana sözleşmeyi ve talep ettiyseniz banka için öngörü tablosunu gönderirim."},
     who:{fr:"Moi",tr:"Ben"}, moi:true},
    {t:{fr:"Vous déposez le capital à la banque",tr:"Sermayeyi bankaya yatırırsınız"},
     d:{fr:"Avec les statuts signés, la banque ouvre le compte et vous délivre l’attestation de dépôt de capital. C’est le document qui débloque la suite.",tr:"İmzalı ana sözleşmeyle banka hesabı açar ve size sermaye yatırım belgesini verir. Devamını açan belge budur."},
     who:{fr:"Vous",tr:"Siz"}, moi:false},
    {t:{fr:"Je publie l’annonce et je dépose à l’INPI",tr:"İlanı yayımlar ve INPI’ye başvururum"},
     d:{fr:"Annonce légale publiée, dossier complet déposé au guichet unique, suivi jusqu’au SIREN et au Kbis. Je vous tiens informé à chaque étape.",tr:"Resmî ilan yayımlanır, tam dosya tek pencereye sunulur, SIREN ve Kbis’e kadar takip edilir. Her adımda sizi bilgilendiririm."},
     who:{fr:"Moi",tr:"Ben"}, moi:true}
  ],

  tarH:{fr:"Deux formules, selon qui sort sa carte bancaire",tr:"Kartı kimin çıkaracağına göre iki formül"},
  tarS:{fr:"Vous la choisirez à la première étape du questionnaire. Voici déjà de quoi décider.",tr:"Formun ilk adımında seçeceksiniz. Karar vermeniz için gerekenler burada."},

  needH:{fr:"Ce qu’il faut avoir sous la main",tr:"Elinizin altında olması gerekenler"},
  needS:{fr:"Préparez-les avant de commencer, vous irez deux fois plus vite. Si l’un d’eux vous manque, commencez quand même : votre brouillon vous attendra.",tr:"Başlamadan önce hazırlayın, iki kat hızlı ilerlersiniz. Biri eksikse yine de başlayın: taslağınız sizi bekler."},
  need:[
    {fr:"Votre <b>pièce d’identité</b> en cours de validité, recto et verso",tr:"Geçerli <b>kimliğiniz</b>, ön ve arka yüz"},
    {fr:"Un <b>justificatif de domicile</b> de moins de 3 mois : quittance, EDF, gaz ou box internet",tr:"3 aydan yeni bir <b>ikametgâh belgesi</b>: kira makbuzu, elektrik, gaz veya internet faturası"},
    {fr:"Le <b>bail</b> du local, si le siège n’est pas à votre domicile",tr:"Merkez evinizde değilse işyerinin <b>kira sözleşmesi</b>"},
    {fr:"Les <b>noms et prénoms de vos parents</b>, y compris le nom de jeune fille de votre mère",tr:"<b>Anne ve babanızın ad ve soyadları</b>, annenizin kızlık soyadı dâhil"},
    {fr:"Le <b>montant du capital</b> que vous comptez déposer",tr:"Yatırmayı düşündüğünüz <b>sermaye tutarı</b>"},
    {fr:"Une <b>feuille blanche et un stylo</b>, pour les mentions manuscrites et votre signature",tr:"El yazısı ibareler ve imzanız için <b>beyaz bir kâğıt ve kalem</b>"}
  ],

  endH:{fr:"Prêt à créer votre société ?",tr:"Şirketinizi kurmaya hazır mısınız?"},
  endP:{fr:"Le questionnaire commence par mes conditions tarifaires. Lisez-les, choisissez votre formule, et le reste se remplit tout seul.",tr:"Form, ücret koşullarımla başlar. Okuyun, formülünüzü seçin; gerisi kendiliğinden ilerler."},
  footNote:{fr:"COMPTARAPIDE · Nemours (77)",tr:"COMPTARAPIDE · Nemours (77)"}
};

/* ============================ field schema ============================ */
function personFields(pre, isBoss){
  var f = [
    {k:pre+"civilite", type:"radio", req:true, l:{fr:"Civilité",tr:"Hitap"}, opts:[{v:"M.",l:{fr:"Monsieur",tr:"Bay"}},{v:"Mme",l:{fr:"Madame",tr:"Bayan"}}]},
    {k:pre+"nom", type:"text", req:true, l:{fr:"Nom de naissance",tr:"Doğum soyadı"}, h:{fr:"Exactement comme sur la pièce d’identité.",tr:"Kimlikteki ile birebir aynı."}},
    {k:pre+"nomUsage", type:"text", l:{fr:"Nom d’usage (si différent)",tr:"Kullanılan soyadı (farklıysa)"}},
    {k:pre+"prenoms", type:"text", req:true, l:{fr:"Prénom(s)",tr:"Ad(lar)"}, h:{fr:"Tous les prénoms figurant sur la pièce d’identité.",tr:"Kimlikte yazan tüm adlar."}},
    {k:pre+"naissDate", type:"date", req:true, l:{fr:"Date de naissance",tr:"Doğum tarihi"}},
    {k:pre+"naissVille", type:"text", req:true, l:{fr:"Commune de naissance",tr:"Doğum yeri (şehir)"}},
    {k:pre+"naissDept", type:"text", l:{fr:"Département de naissance",tr:"Doğum ili/bölgesi"}, h:{fr:"Si né(e) en France (n° à 2 ou 3 chiffres).",tr:"Fransa’da doğduysa (2-3 haneli kod)."}},
    {k:pre+"naissPays", type:"text", req:true, l:{fr:"Pays de naissance",tr:"Doğum ülkesi"}, def:"France"},
    {k:pre+"nationalite", type:"text", req:true, l:{fr:"Nationalité",tr:"Uyruk"}, def:"Française"},
    {k:pre+"adresse", type:"text", req:true, full:true, l:{fr:"Adresse personnelle (n° et rue)",tr:"Ev adresi (numara ve sokak)"}},
    {k:pre+"cp", type:"text", req:true, l:{fr:"Code postal",tr:"Posta kodu"}},
    {k:pre+"ville", type:"text", req:true, l:{fr:"Ville",tr:"Şehir"}},
    {k:pre+"pays", type:"text", req:true, l:{fr:"Pays de résidence",tr:"İkamet ülkesi"}, def:"France"},
    {k:pre+"email", type:"email", req:true, l:{fr:"E-mail",tr:"E-posta"}},
    {k:pre+"tel", type:"tel", req:true, l:{fr:"Téléphone",tr:"Telefon"}},
    {k:pre+"matri", type:"select", req:true, l:{fr:"Situation matrimoniale",tr:"Medeni durum"},
      opts:[{v:"Célibataire",l:{fr:"Célibataire",tr:"Bekâr"}},{v:"Marié(e)",l:{fr:"Marié(e)",tr:"Evli"}},{v:"Pacsé(e)",l:{fr:"Pacsé(e)",tr:"PACS’lı"}},{v:"Divorcé(e)",l:{fr:"Divorcé(e)",tr:"Boşanmış"}},{v:"Veuf(ve)",l:{fr:"Veuf(ve)",tr:"Dul"}}]},
    {k:pre+"regime", type:"text", l:{fr:"Régime matrimonial (si marié·e)",tr:"Mal rejimi (evliyse)"}, h:{fr:"Ex. communauté légale, séparation de biens. L’INPI le demande.",tr:"Örn. yasal mal ortaklığı, mal ayrılığı. INPI bunu ister."}, show:function(){return /Marié|Pacsé/.test(D.ans[pre+"matri"]||"");}},
    {k:pre+"conjoint", type:"text", l:{fr:"Nom et prénom du conjoint",tr:"Eşin adı ve soyadı"}, show:function(){return /Marié|Pacsé/.test(D.ans[pre+"matri"]||"");}},

    {sep:{fr:"Filiation — obligatoire pour la Déclaration de Non-Condamnation (DNC)",tr:"Soybağı — Sabıkasızlık Beyanı (DNC) için zorunlu"}},
    {k:pre+"pereNom", type:"text", req:true, l:{fr:"Nom du père",tr:"Babanın soyadı"}},
    {k:pre+"perePrenom", type:"text", req:true, l:{fr:"Prénom du père",tr:"Babanın adı"}},
    {k:pre+"mereNom", type:"text", req:true, l:{fr:"Nom de jeune fille de la mère",tr:"Annenin kızlık soyadı"}},
    {k:pre+"merePrenom", type:"text", req:true, l:{fr:"Prénom de la mère",tr:"Annenin adı"}},

    {sep:{fr:"Participation au capital",tr:"Sermaye payı"}},
    {k:pre+"apportNum", type:"number", req:true, l:{fr:"Apport en numéraire (€)",tr:"Nakdi sermaye (€)"}, h:{fr:"Somme versée sur le compte de dépôt de capital.",tr:"Sermaye bloke hesabına yatırılan tutar."}},
    {k:pre+"apportNat", type:"number", l:{fr:"Apport en nature (€)",tr:"Ayni sermaye (€)"}, h:{fr:"Matériel apporté. Plafonné au montant total du numéraire.",tr:"Getirilen ekipman. Toplam nakit tutarı ile sınırlıdır."}},
    {k:pre+"parts", type:"number", req:true, l:{fr:"Pourcentage de détention (%)",tr:"Sahiplik yüzdesi (%)"}, h:{fr:"Sert à la déclaration des bénéficiaires effectifs (RBE).",tr:"Gerçek faydalanıcı beyanı (RBE) için gereklidir."}}
  ];
  if(isBoss){
    f.push({sep:{fr:"Fonction de direction",tr:"Yönetim görevi"}});
    f.push({k:pre+"secu", type:"text", l:{fr:"N° de sécurité sociale (15 chiffres)",tr:"Sosyal güvenlik numarası (15 hane)"}, h:{fr:"Demandé par l’INPI pour l’affiliation sociale du dirigeant.",tr:"Yöneticinin sosyal güvenlik kaydı için INPI tarafından istenir."}});
    f.push({k:pre+"remun", type:"radio", req:true, l:{fr:"Le dirigeant sera-t-il rémunéré ?",tr:"Yönetici maaş alacak mı?"}, opts:[{v:"Oui",l:S.yes},{v:"Non",l:S.no}]});
    f.push({k:pre+"acre", type:"radio", req:true, l:{fr:"Demande d’ACRE (exonération de début d’activité) ?",tr:"ACRE talebi (başlangıç muafiyeti)?"}, opts:[{v:"Oui",l:S.yes},{v:"Non",l:S.no},{v:"À étudier",l:{fr:"À étudier avec vous",tr:"Sizinle değerlendirilecek"}}]});
    f.push({k:pre+"activiteAnt", type:"radio", req:true, l:{fr:"Exerciez-vous déjà une activité non salariée ?",tr:"Daha önce serbest faaliyetiniz var mıydı?"}, opts:[{v:"Non",l:S.no},{v:"Oui",l:S.yes}]});
    f.push({k:pre+"conjointCollab", type:"radio", l:{fr:"Conjoint collaborateur dans la société ?",tr:"Şirkette eş çalışacak mı?"}, opts:[{v:"Non",l:S.no},{v:"Oui",l:S.yes}], show:function(){return /Marié|Pacsé/.test(D.ans[pre+"matri"]||"");}});
  }
  return f;
}

var STEPS = [
  { id:"conditions", nm:{fr:"Conditions",tr:"Koşullar"}, custom:"conditions" },
  { id:"societe", nm:{fr:"La société",tr:"Şirket"},
    eyebrow:{fr:"Étape 2",tr:"Adım 2"},
    h:{fr:"La société à créer",tr:"Kurulacak şirket"},
    lede:{fr:"Ces informations sont reprises mot pour mot dans les statuts, l’annonce légale et le dossier INPI. La moindre différence entre les trois provoque un rejet.",tr:"Bu bilgiler ana sözleşmeye, resmî ilana ve INPI dosyasına harfi harfine geçer. Üçü arasındaki en küçük fark reddedilmeye yol açar."},
    fields:[
      {k:"forme", type:"radio", req:true, full:true, l:{fr:"Forme juridique",tr:"Hukuki biçim"}, h:{fr:"EURL / SARL : le dirigeant est « Gérant ». SASU / SAS : il est « Président ».",tr:"EURL / SARL: yönetici « Gérant ». SASU / SAS: « Président »."},
        opts:[{v:"EURL",l:{fr:"EURL (1 associé)",tr:"EURL (1 ortak)"}},{v:"SARL",l:{fr:"SARL (2+ associés)",tr:"SARL (2+ ortak)"}},{v:"SASU",l:{fr:"SASU (1 associé)",tr:"SASU (1 ortak)"}},{v:"SAS",l:{fr:"SAS (2+ associés)",tr:"SAS (2+ ortak)"}}]},
      {k:"denom", type:"text", req:true, full:true, l:{fr:"Dénomination sociale",tr:"Şirket unvanı"}, h:{fr:"Le nom officiel de la société. Vérifiez qu’il est disponible à l’INPI avant de le figer.",tr:"Şirketin resmî adı. Belirlemeden önce INPI’de müsaitliğini kontrol edin."}},
      {k:"sigle", type:"text", l:{fr:"Sigle ou enseigne (facultatif)",tr:"Kısaltma veya işletme adı (isteğe bağlı)"}},
      {k:"nomDomaine", type:"text", l:{fr:"Nom de domaine (facultatif)",tr:"Alan adı (isteğe bağlı)"}},
      {sep:{fr:"Siège social",tr:"Merkez adresi"}},
      {k:"siegeType", type:"radio", req:true, full:true, l:{fr:"Le siège social sera :",tr:"Şirket merkezi:"},
        opts:[{v:"Domicile du dirigeant",l:{fr:"Au domicile du dirigeant",tr:"Yöneticinin evinde"}},{v:"Local loué (bail)",l:{fr:"Un local loué (bail)",tr:"Kiralık işyeri (kira sözleşmesi)"}},{v:"Société de domiciliation",l:{fr:"Société de domiciliation",tr:"Adres sağlayıcı şirket"}}]},
      {k:"siegeAdresse", type:"text", req:true, full:true, l:{fr:"Adresse du siège (n° et rue)",tr:"Merkez adresi (numara ve sokak)"}},
      {k:"siegeCompl", type:"text", l:{fr:"Complément (bâtiment, étage…)",tr:"Ek bilgi (bina, kat…)"}},
      {k:"siegeCp", type:"text", req:true, l:{fr:"Code postal",tr:"Posta kodu"}},
      {k:"siegeVille", type:"text", req:true, l:{fr:"Ville",tr:"Şehir"}},
      {k:"domiciliataire", type:"text", l:{fr:"Nom et n° d’agrément du domiciliataire",tr:"Adres sağlayıcının adı ve yetki numarası"}, show:function(){return D.ans.siegeType==="Société de domiciliation";}},
      {sep:{fr:"Capital social",tr:"Sermaye"}},
      {k:"capitalNum", type:"number", req:true, l:{fr:"Capital en numéraire (€)",tr:"Nakdi sermaye (€)"}, h:{fr:"Montant réellement déposé sur le compte bloqué.",tr:"Bloke hesaba fiilen yatırılan tutar."}},
      {k:"capitalNat", type:"number", l:{fr:"Capital en nature (€)",tr:"Ayni sermaye (€)"}, h:{fr:"Matériel apporté, sur liste détaillée. Au maximum égal au numéraire — le capital peut donc être doublé.",tr:"Detaylı listeye göre getirilen ekipman. En fazla nakit tutar kadar — sermaye böylece ikiye katlanabilir."}},
      {k:"liberation", type:"radio", req:true, full:true, l:{fr:"Libération du capital numéraire",tr:"Nakdi sermayenin ödenmesi"}, h:{fr:"SARL/EURL : 20 % minimum. SAS/SASU : 50 % minimum. Le solde dans les 5 ans.",tr:"SARL/EURL: en az %20. SAS/SASU: en az %50. Kalanı 5 yıl içinde."},
        opts:[{v:"Intégralité (100 %)",l:{fr:"Intégralité (100 %)",tr:"Tamamı (%100)"}},{v:"Partielle",l:{fr:"Partielle (minimum légal)",tr:"Kısmi (yasal asgari)"}}]},
      {sep:{fr:"Activité",tr:"Faaliyet"}},
      {k:"objet", type:"textarea", req:true, full:true, max:840, l:{fr:"Objet social",tr:"Faaliyet konusu"}, h:{fr:"Décrivez précisément toutes les activités, présentes et envisagées. Un objet vague est le premier motif de rejet à l’INPI. 840 caractères maximum.",tr:"Mevcut ve planlanan tüm faaliyetleri net biçimde yazın. Belirsiz bir konu, INPI’de en sık ret sebebidir. En fazla 840 karakter."}},
      {k:"activitePrinc", type:"text", req:true, full:true, l:{fr:"Activité principale réellement exercée",tr:"Fiilen yürütülecek ana faaliyet"}, h:{fr:"En une ligne. Sert à déterminer le code APE.",tr:"Tek satır. APE kodunu belirlemek için kullanılır."}},
      {k:"reglementee", type:"radio", req:true, full:true, l:{fr:"Activité réglementée ?",tr:"Düzenlemeye tabi faaliyet mi?"}, h:{fr:"Bâtiment, transport, sécurité, alimentaire, santé, immobilier… Un diplôme, une carte ou une assurance peut être exigé.",tr:"İnşaat, taşımacılık, güvenlik, gıda, sağlık, emlak… Diploma, kart veya sigorta gerekebilir."},
        opts:[{v:"Non",l:S.no},{v:"Oui",l:S.yes},{v:"Je ne sais pas",l:{fr:"Je ne sais pas",tr:"Bilmiyorum"}}]},
      {k:"reglementeeDet", type:"text", full:true, l:{fr:"Précisez le diplôme / la qualification / l’agrément",tr:"Diploma / yeterlilik / yetki belgesini belirtin"}, show:function(){return D.ans.reglementee==="Oui";}},
      {k:"dateDebut", type:"date", req:true, l:{fr:"Date de début d’activité souhaitée",tr:"İstenen faaliyet başlangıç tarihi"}},
      {k:"cloture", type:"text", req:true, l:{fr:"Date de clôture du 1ᵉʳ exercice",tr:"İlk mali yılın kapanış tarihi"}, def:"31/12", h:{fr:"Le plus souvent le 31/12. Le premier exercice peut durer jusqu’à 24 mois.",tr:"Genellikle 31/12. İlk mali yıl 24 aya kadar sürebilir."}},
      {k:"salaries", type:"radio", req:true, full:true, l:{fr:"Embauche de salariés prévue dès la création ?",tr:"Kuruluşta personel istihdamı planlanıyor mu?"}, opts:[{v:"Non",l:S.no},{v:"Oui",l:S.yes}]},
      {k:"salariesNb", type:"number", l:{fr:"Nombre de salariés prévus",tr:"Planlanan personel sayısı"}, show:function(){return D.ans.salaries==="Oui";}}
    ]},
  { id:"dirigeant", nm:{fr:"Dirigeant",tr:"Yönetici"},
    eyebrow:{fr:"Étape 3",tr:"Adım 3"},
    h:{fr:"Le dirigeant",tr:"Yönetici"},
    lede:{fr:"Le Gérant (EURL/SARL) ou le Président (SAS/SASU). Recopiez les noms et prénoms exactement comme sur la pièce d’identité : une orthographe différente entre les statuts et la pièce d’identité fait rejeter le dossier.",tr:"Gérant (EURL/SARL) veya Président (SAS/SASU). Ad ve soyadları kimlikteki gibi birebir yazın: ana sözleşme ile kimlik arasındaki yazım farkı dosyanın reddine yol açar."},
    fields: personFields("d_", true) },
  { id:"associes", nm:{fr:"Autres associés",tr:"Diğer ortaklar"}, custom:"associes" },
  { id:"fiscal", nm:{fr:"Fiscalité & banque",tr:"Vergi & banka"},
    eyebrow:{fr:"Étape 5",tr:"Adım 5"},
    h:{fr:"Options fiscales, TVA et banque",tr:"Vergi, KDV ve banka"},
    lede:{fr:"Ces choix sont demandés au moment du dépôt INPI et engagent la société pour plusieurs exercices. En cas de doute, choisissez « À décider ensemble » : nous en parlerons avant le dépôt.",tr:"Bu tercihler INPI başvurusunda sorulur ve şirketi birkaç mali yıl bağlar. Emin değilseniz « Birlikte karar verilecek » seçin: başvurudan önce konuşuruz."},
    fields:[
      {k:"impot", type:"radio", req:true, full:true, l:{fr:"Imposition des bénéfices",tr:"Kârın vergilendirilmesi"},
        opts:[{v:"IS",l:{fr:"Impôt sur les sociétés (IS)",tr:"Kurumlar vergisi (IS)"}},{v:"IR",l:{fr:"Impôt sur le revenu (IR)",tr:"Gelir vergisi (IR)"}},{v:"À décider",l:{fr:"À décider ensemble",tr:"Birlikte karar verilecek"}}]},
      {k:"regimeBIC", type:"radio", req:true, full:true, l:{fr:"Régime d’imposition",tr:"Vergilendirme rejimi"},
        opts:[{v:"Réel simplifié",l:{fr:"Réel simplifié",tr:"Basitleştirilmiş gerçek usul"}},{v:"Réel normal",l:{fr:"Réel normal",tr:"Normal gerçek usul"}},{v:"À décider",l:{fr:"À décider ensemble",tr:"Birlikte karar verilecek"}}]},
      {k:"tva", type:"radio", req:true, full:true, l:{fr:"Régime de TVA",tr:"KDV rejimi"},
        opts:[{v:"Franchise en base",l:{fr:"Franchise en base (pas de TVA)",tr:"Muafiyet (KDV yok)"}},{v:"Réel simplifié",l:{fr:"Réel simplifié (CA12)",tr:"Basitleştirilmiş (CA12)"}},{v:"Réel normal",l:{fr:"Réel normal (CA3 mensuelle)",tr:"Normal (aylık CA3)"}},{v:"À décider",l:{fr:"À décider ensemble",tr:"Birlikte karar verilecek"}}]},
      {k:"tvaIntra", type:"radio", req:true, full:true, l:{fr:"Opérations avec l’étranger prévues ?",tr:"Yurt dışı işlemleri planlanıyor mu?"}, h:{fr:"Achats ou ventes dans l’UE ou hors UE : un n° de TVA intracommunautaire sera demandé.",tr:"AB içi veya dışı alım-satım: AB KDV numarası talep edilecektir."}, opts:[{v:"Non",l:S.no},{v:"Oui",l:S.yes}]},
      {sep:{fr:"Dépôt du capital",tr:"Sermaye yatırımı"}},
      {k:"banque", type:"text", req:true, full:true, l:{fr:"Banque ou plateforme choisie pour le dépôt de capital",tr:"Sermaye yatırımı için seçilen banka veya platform"}, h:{fr:"Le dépôt se fait avant la signature définitive des statuts. L’attestation de dépôt est indispensable au dépôt INPI.",tr:"Yatırım, ana sözleşmenin nihai imzasından önce yapılır. Yatırım belgesi INPI başvurusu için zorunludur."}},
      {k:"previsionnel", type:"radio", req:true, full:true, l:{fr:"Avez-vous besoin d’un prévisionnel pour la banque ?",tr:"Banka için bir öngörü tablosuna ihtiyacınız var mı?"}, h:{fr:"Inclus dans le premier versement si vous le demandez maintenant.",tr:"Şimdi talep ederseniz ilk ödemeye dâhildir."}, opts:[{v:"Oui",l:S.yes},{v:"Non",l:S.no}]},
      {k:"remarques", type:"textarea", full:true, l:{fr:"Remarques ou questions à me transmettre",tr:"Bana iletmek istediğiniz notlar veya sorular"}}
    ]},
  { id:"documents", nm:{fr:"Pièces justificatives",tr:"Belgeler"}, custom:"documents" },
  { id:"mentions", nm:{fr:"Mentions manuscrites",tr:"El yazısı ibareler"}, custom:"mentions" },
  { id:"signature", nm:{fr:"Signature & initiales",tr:"İmza & paraf"}, custom:"signature" },
  { id:"recap", nm:{fr:"Envoi du dossier",tr:"Dosyanın gönderimi"}, custom:"recap" }
];

/* ============================ document slots ============================ */
function docSlots(){
  var L = [];
  L.push({k:"siege", req:true,
    n:function(){ return D.ans.siegeType==="Domicile du dirigeant"
      ? {fr:"Justificatif d’occupation du siège",tr:"Merkez adresi kullanım belgesi"}
      : (D.ans.siegeType==="Société de domiciliation" ? {fr:"Contrat de domiciliation",tr:"Adres sağlayıcı sözleşmesi"} : {fr:"Bail du local (siège social)",tr:"İşyeri kira sözleşmesi (merkez)"}); },
    d:function(){ return D.ans.siegeType==="Domicile du dirigeant"
      ? {fr:"Le siège étant chez le dirigeant, une quittance ou facture à son nom suffit — mais elle doit porter l’adresse exacte du siège.",tr:"Merkez yöneticinin evinde olduğundan, adına düzenlenmiş bir fatura yeterlidir — ancak merkez adresini birebir taşımalıdır."}
      : {fr:"Toutes les pages signées, y compris la page des signatures.",tr:"İmza sayfası dâhil, imzalanmış tüm sayfalar."}; }});
  L.push({k:"domicile", req:true, n:{fr:"Justificatif de domicile du dirigeant",tr:"Yöneticinin ikametgâh belgesi"},
    d:{fr:"Quittance de loyer, facture EDF, gaz ou box internet — de moins de 3 mois, au nom du dirigeant.",tr:"Kira makbuzu, elektrik, doğalgaz veya internet faturası — 3 aydan yeni, yöneticinin adına."}});
  var ppl = allPeople();
  for(var i=0;i<ppl.length;i++){
    (function(p,i){
      var who = p.name || (i===0 ? {fr:"le dirigeant",tr:"yönetici"} : {fr:"l’associé "+(i+1),tr:(i+1)+". ortak"});
      L.push({k:"cni_r_"+p.pre, req:true, n:{fr:"Pièce d’identité — RECTO ("+t(who)+")",tr:"Kimlik — ÖN YÜZ ("+t(who)+")"},
        d:{fr:"CNI ou passeport en cours de validité. Scan ou photo couleur, nette, les 4 coins visibles.",tr:"Geçerli kimlik veya pasaport. Renkli, net, 4 köşesi görünen fotoğraf."}});
      L.push({k:"cni_v_"+p.pre, req:true, n:{fr:"Pièce d’identité — VERSO ("+t(who)+")",tr:"Kimlik — ARKA YÜZ ("+t(who)+")"},
        d:{fr:"Le verso est obligatoire même pour un passeport (page de signature).",tr:"Pasaportta bile arka yüz zorunludur (imza sayfası)."}});
      if(D.ans[p.pre+"nationalite"] && !/franc|français/i.test(D.ans[p.pre+"nationalite"]||"")){
        L.push({k:"sejour_"+p.pre, req:false, n:{fr:"Titre de séjour ("+t(who)+")",tr:"Oturma izni ("+t(who)+")"},
          d:{fr:"Recto-verso, si vous n’êtes pas ressortissant de l’Union européenne.",tr:"Ön ve arka yüz, AB vatandaşı değilseniz."}});
      }
    })(ppl[i],i);
  }
  if(Number(D.ans.capitalNat||0)>0){
    L.push({k:"materiel", req:true, n:{fr:"Liste détaillée du matériel apporté",tr:"Getirilen ekipmanın detaylı listesi"},
      d:{fr:"Désignation, quantité et valeur de chaque bien, avec les factures si vous les avez.",tr:"Her malın tanımı, adedi ve değeri; varsa faturaları ile birlikte."}});
  }
  L.push({k:"rib", req:false, n:{fr:"RIB personnel du dirigeant (facultatif)",tr:"Yöneticinin kişisel IBAN belgesi (isteğe bağlı)"},
    d:{fr:"Demandé par certaines banques pour ouvrir le compte de dépôt de capital.",tr:"Bazı bankalar sermaye hesabı açmak için ister."}});
  L.push({k:"autre", req:false, n:{fr:"Autre document utile (facultatif)",tr:"Diğer faydalı belge (isteğe bağlı)"},
    d:{fr:"Diplôme, carte professionnelle, attestation d’assurance, ancien Kbis…",tr:"Diploma, meslek kartı, sigorta belgesi, eski Kbis…"}});
  return L;
}

function mentionSlots(){
  return [
    {k:"m_lu", txt:"Lu et approuvé", sub:{fr:"Rien d’autre sur la ligne.",tr:"Satırda başka bir şey olmasın."}},
    {k:"m_conf", txt:"Certifié conforme à l’original, le "+todayFR(), sub:{fr:"La date du jour, écrite en chiffres.",tr:"Bugünün tarihi, rakamla."}},
    {k:"m_fonc", txt:"Lu et approuvé, bon pour acceptation des fonctions de "+chief(), sub:{fr:"La fonction dépend de la forme juridique que vous avez choisie.",tr:"Görev, seçtiğiniz hukuki biçime göre değişir."}},
    {k:"m_pouv", txt:"Bon pour pouvoir", sub:{fr:"Sert au mandat que vous me donnez pour déposer le dossier.",tr:"Dosyayı sunmam için bana verdiğiniz vekâlet içindir."}}
  ];
}
function signSlots(){
  return [
    {k:"s_sign", req:true, n:{fr:"Votre signature",tr:"İmzanız"}, d:{fr:"Signez 3 fois, bien espacées, au milieu d’une feuille blanche non lignée.",tr:"Çizgisiz beyaz bir kâğıdın ortasına, aralıklı olarak 3 kez imzalayın."}},
    {k:"s_init", req:true, n:{fr:"Vos initiales (paraphe)",tr:"Parafınız (baş harfler)"}, d:{fr:"Ex. « A.C. ». Écrivez-les 3 fois sur la même feuille blanche.",tr:"Örn. « A.C. ». Aynı beyaz kâğıda 3 kez yazın."}}
  ];
}

function allPeople(){
  var out = [{pre:"d_", name:null, boss:true}];
  var n = (D.ans.d_nom||"")+" "+(D.ans.d_prenoms||"");
  if(n.trim()) out[0].name = n.trim();
  for(var i=0;i<D.people.length;i++){
    var pre = "a"+i+"_";
    var nm = ((D.ans[pre+"nom"]||"")+" "+(D.ans[pre+"prenoms"]||"")).trim();
    out.push({pre:pre, name:nm||null, boss:false});
  }
  return out;
}

/* ============================ field rendering ============================ */
function renderFields(list, host){
  var grid = el("div","grid");
  list.forEach(function(f){
    if(f.sep){
      var s = el("div","f full");
      var hh = el("div","sect-h"); hh.style.margin="10px 0 -2px";
      var h3 = el("h3", null, t(f.sep)); hh.appendChild(h3);
      s.appendChild(hh); grid.appendChild(s); return;
    }
    if(f.show && !f.show()) return;
    var wrap = el("div","f"+(f.full||f.type==="textarea"||f.type==="radio"?" full":""));
    wrap.dataset.k = f.k;
    var lab = el("label", null, t(f.l));
    lab.setAttribute("for","fld_"+f.k);
    if(f.req){ var r=el("span","req","*"); lab.appendChild(r); }
    wrap.appendChild(lab);
    var helpEl = f.h ? el("div","help", t(f.h)) : null;

    var cur = D.ans[f.k];
    if(cur==null && f.def!=null){ cur = f.def; D.ans[f.k]=f.def; }

    if(f.type==="radio" || f.type==="textarea"){ if(helpEl){ wrap.appendChild(helpEl); helpEl=null; } }
    if(f.type==="radio"){
      var ch = el("div","choices"); ch.id="fld_"+f.k;
      f.opts.forEach(function(o){
        var c = el("label","choice");
        var inp = document.createElement("input");
        inp.type="radio"; inp.name="rad_"+f.k; inp.value=o.v;
        inp.id = "fld_"+f.k+"_"+slug(o.v);
        if(cur===o.v) inp.checked=true;
        inp.addEventListener("change",function(){ D.ans[f.k]=o.v; wrap.classList.remove("bad"); save(); rerender(); });
        c.appendChild(inp); c.appendChild(el("span",null,t(o.l)));
        ch.appendChild(c);
      });
      wrap.appendChild(ch);
    } else if(f.type==="select"){
      var sel = document.createElement("select"); sel.id="fld_"+f.k;
      var ph = document.createElement("option"); ph.value=""; ph.textContent=t(S.choose); sel.appendChild(ph);
      f.opts.forEach(function(o){ var op=document.createElement("option"); op.value=o.v; op.textContent=t(o.l); if(cur===o.v) op.selected=true; sel.appendChild(op); });
      sel.addEventListener("change",function(){ D.ans[f.k]=sel.value; wrap.classList.remove("bad"); save(); rerender(); });
      wrap.appendChild(sel);
    } else if(f.type==="textarea"){
      var ta = document.createElement("textarea"); ta.id="fld_"+f.k; ta.value = cur||"";
      if(f.max) ta.maxLength = f.max;
      var cnt = el("div","counter");
      function upd(){ if(!f.max) return; var n=ta.value.length; cnt.textContent = n+" / "+f.max+" "+t(S.chars); cnt.classList.toggle("over", n>=f.max); }
      ta.addEventListener("input",function(){ D.ans[f.k]=ta.value; wrap.classList.remove("bad"); upd(); saveDebounced(); });
      wrap.appendChild(ta); if(f.max){ wrap.appendChild(cnt); upd(); }
    } else {
      var inp2 = document.createElement("input");
      inp2.type = (f.type==="number"?"number":f.type==="date"?"date":f.type==="email"?"email":f.type==="tel"?"tel":"text");
      if(f.type==="number"){ inp2.min="0"; inp2.step="0.01"; }
      inp2.id="fld_"+f.k; inp2.value = cur==null?"":cur;
      inp2.autocomplete = "off";
      inp2.addEventListener("input",function(){ D.ans[f.k]=inp2.value; wrap.classList.remove("bad"); saveDebounced(); });
      inp2.addEventListener("change",function(){ D.ans[f.k]=inp2.value; save(); });
      wrap.appendChild(inp2);
    }
    if(helpEl) wrap.appendChild(helpEl);
    wrap.appendChild(el("div","err", t(S.required)));
    grid.appendChild(wrap);
  });
  host.appendChild(grid);
}

function validateFields(list, host){
  var ok = true, first=null;
  list.forEach(function(f){
    if(f.sep || !f.req) return;
    if(f.show && !f.show()) return;
    var v = D.ans[f.k];
    if(v==null || String(v).trim()===""){
      ok=false;
      var w = host.querySelector('.f[data-k="'+f.k+'"]');
      if(w){ w.classList.add("bad"); if(!first) first=w; }
    }
  });
  if(first) first.scrollIntoView({behavior:"smooth",block:"center"});
  return ok;
}

/* ============================ photo capture ============================ */
function compress(file, cb){
  var fr = new FileReader();
  fr.onload = function(){
    var img = new Image();
    img.onload = function(){
      var MAX = 1500, w=img.width, h=img.height;
      var sc = Math.min(1, MAX/Math.max(w,h));
      w = Math.round(w*sc); h = Math.round(h*sc);
      var cv = document.createElement("canvas"); cv.width=w; cv.height=h;
      var cx = cv.getContext("2d"); cx.fillStyle="#fff"; cx.fillRect(0,0,w,h); cx.drawImage(img,0,0,w,h);
      var q = 0.82, url = cv.toDataURL("image/jpeg", q);
      while(url.length > 430000 && q > 0.42){ q -= 0.1; url = cv.toDataURL("image/jpeg", q); }
      cb({dataUrl:url, name:file.name||"photo.jpg", bytes:Math.round(url.length*0.75)});
    };
    img.onerror = function(){ cb(null); };
    img.src = fr.result;
  };
  fr.onerror = function(){ cb(null); };
  fr.readAsDataURL(file);
}

function captureCard(slot, lockedMsg){
  var name = typeof slot.n==="function" ? slot.n() : slot.n;
  var desc = typeof slot.d==="function" ? slot.d() : slot.d;
  var c = el("div","cap");
  if(PHOTOS[slot.k]) c.classList.add("has");
  var nm = el("div","cn", t(name));
  if(slot.req){ var st=el("span","req"," *"); st.style.color="var(--accent)"; nm.appendChild(st); }
  c.appendChild(nm);
  if(desc) c.appendChild(el("div","cd", t(desc)));
  var th = el("div","thumb");
  if(PHOTOS[slot.k]){ var im=document.createElement("img"); im.src=PHOTOS[slot.k].dataUrl; im.alt=t(name); th.appendChild(im); }
  else th.appendChild(el("div","ph", t(S.noPhoto)));
  c.appendChild(th);
  if(PHOTOS[slot.k]) c.appendChild(el("div","sz", Math.round(PHOTOS[slot.k].bytes/1024)+" Ko"));
  var row = el("div","row");
  var lab = el("label","take", PHOTOS[slot.k]? t(S.rephoto) : t(S.photo));
  var inp = document.createElement("input");
  inp.type="file"; inp.accept="image/*"; inp.setAttribute("capture","environment");
  inp.id = "cap_"+slot.k;
  lab.setAttribute("for", inp.id);
  if(lockedMsg){ inp.disabled = true; lab.style.opacity=".45"; lab.style.cursor="not-allowed"; }
  inp.addEventListener("change",function(){
    var f = inp.files && inp.files[0]; if(!f) return;
    lab.textContent = "…";
    compress(f, function(res){
      if(res){ PHOTOS[slot.k]=res; savePhoto(slot.k,res); }
      rerender();
    });
  });
  row.appendChild(lab); row.appendChild(inp);
  if(PHOTOS[slot.k]){
    var del = el("button","btn-x", t(S.del)); del.type="button";
    del.addEventListener("click",function(){ delete PHOTOS[slot.k]; delPhoto(slot.k); rerender(); });
    row.appendChild(del);
  }
  c.appendChild(row);
  return c;
}

/* ============================ persistence ============================ */
var _sv;
function saveDebounced(){ clearTimeout(_sv); _sv=setTimeout(save, 700); }
function save(){ try{ localStorage.setItem("cr_data", JSON.stringify(D)); }catch(e){} }
function load(){ try{ var s=localStorage.getItem("cr_data"); if(s){ var p=JSON.parse(s); if(p&&p.ans){ D=p; D.people=D.people||[]; } } }catch(e){} }

var idb=null;
function openIDB(cb){
  try{
    var rq = indexedDB.open("comptarapide_dossier",1);
    rq.onupgradeneeded=function(){ rq.result.createObjectStore("ph"); };
    rq.onsuccess=function(){ idb=rq.result; cb&&cb(); };
    rq.onerror=function(){ cb&&cb(); };
  }catch(e){ cb&&cb(); }
}
function savePhoto(k,v){ try{ if(!idb) return; idb.transaction("ph","readwrite").objectStore("ph").put(v,k); }catch(e){} }
function delPhoto(k){ try{ if(!idb) return; idb.transaction("ph","readwrite").objectStore("ph").delete(k); }catch(e){} }
function loadPhotos(cb){
  if(!idb){ cb(); return; }
  try{
    var st = idb.transaction("ph","readonly").objectStore("ph");
    var kr = st.getAllKeys(), vr = st.getAll();
    vr.onsuccess=function(){ var ks=kr.result||[], vs=vr.result||[]; for(var i=0;i<ks.length;i++) PHOTOS[ks[i]]=vs[i]; cb(); };
    vr.onerror=function(){ cb(); };
  }catch(e){ cb(); }
}

/* ============================ panels ============================ */

function hasDraft(){
  return !!(D.ans.formule || D.ans.denom || D.ans.d_nom || Object.keys(PHOTOS).length);
}
function waHref(txt){
  var C = window.CR_CONFIG || {};
  return "https://wa.me/"+(C.WHATSAPP||"33745281828")+"?text="+encodeURIComponent(txt);
}

function panelHome(host){
  var wrapH = el("div","home");

  /* ---- hero ---- */
  var hero = el("header","hero");
  ["light","dark"].forEach(function(v){
    var lg = document.createElement("img");
    lg.className = "hero-logo logo logo-"+v;
    lg.alt = "COMPTARAPIDE";
    lg.src = "logo-"+v+".png";
    hero.appendChild(lg);
  });
  hero.appendChild(el("div","hero-kicker", t(H.kicker)));
  hero.appendChild(el("h1", null, t(H.h1)));
  var ld = el("p","hero-lede"); ld.innerHTML = t(H.lede); hero.appendChild(ld);

  var cta = el("div","hero-cta");
  var b1 = el("button","btn prim big", hasDraft() ? t(H.resume) + " →" : t(H.start) + " →");
  b1.type="button"; b1.id="home_start";
  b1.addEventListener("click", enterForm);
  cta.appendChild(b1);
  var b2 = document.createElement("a");
  b2.className="btn sec big"; b2.target="_blank"; b2.rel="noopener";
  b2.href = waHref(LANG==="fr" ? "Bonjour Abdou, je voudrais créer une société. Pouvez-vous remplir le questionnaire avec moi ?" : "Merhaba Abdou, bir şirket kurmak istiyorum. Formu benimle birlikte doldurabilir misiniz?");
  b2.textContent = t(H.callme);
  cta.appendChild(b2);
  hero.appendChild(cta);

  var mt = el("div","hero-meta");
  [H.meta1,H.meta2,H.meta3].forEach(function(x){ mt.appendChild(el("span",null,t(x))); });
  hero.appendChild(mt);
  wrapH.appendChild(hero);

  /* ---- ce que je prends en charge ---- */
  var s1 = el("section","hsec");
  s1.appendChild(el("h2",null,t(H.incH)));
  s1.appendChild(el("p","sub",t(H.incS)));
  var g1 = el("div","inc-grid");
  H.inc.forEach(function(x){
    var c = el("div","inc-i");
    c.appendChild(el("h3",null,t(x.t)));
    c.appendChild(el("p",null,t(x.d)));
    g1.appendChild(c);
  });
  s1.appendChild(g1);
  wrapH.appendChild(s1);

  /* ---- assistance ---- */
  var s2 = el("section","hsec");
  s2.appendChild(el("h2",null,t(H.helpH)));
  s2.appendChild(el("p","sub",t(H.helpS)));
  var g2 = el("div","help-grid");

  var c1 = el("div","help-c");
  c1.appendChild(el("div","tag2",t(H.help1tag)));
  c1.appendChild(el("h3",null,t(H.help1t)));
  c1.appendChild(el("p",null,t(H.help1d)));
  var a1 = document.createElement("a");
  a1.className="btn sec"; a1.target="_blank"; a1.rel="noopener";
  a1.href = waHref(LANG==="fr" ? "Bonjour Abdou, j’ai une question sur le questionnaire de création." : "Merhaba Abdou, kuruluş formu hakkında bir sorum var.");
  a1.textContent = t(H.waBtn);
  c1.appendChild(a1);
  g2.appendChild(c1);

  var c2 = el("div","help-c lead");
  c2.appendChild(el("div","tag2",t(H.help2tag)));
  c2.appendChild(el("h3",null,t(H.help2t)));
  c2.appendChild(el("p",null,t(H.help2d)));
  var a2 = document.createElement("a");
  a2.className="btn prim"; a2.target="_blank"; a2.rel="noopener";
  a2.href = waHref(LANG==="fr" ? "Bonjour Abdou, je préfère que vous remplissiez le questionnaire pour moi. Quand pouvons-nous en parler ?" : "Merhaba Abdou, formu benim yerime sizin doldurmanızı tercih ederim. Ne zaman konuşabiliriz?");
  a2.textContent = t(H.callme);
  c2.appendChild(a2);
  g2.appendChild(c2);

  s2.appendChild(g2);
  wrapH.appendChild(s2);

  /* ---- déroulé ---- */
  var s3 = el("section","hsec");
  s3.appendChild(el("h2",null,t(H.flowH)));
  var fl = el("div","flow");
  H.flow.forEach(function(x){
    var i = el("div","flow-i");
    var box = el("div");
    box.appendChild(el("h3",null,t(x.t)));
    box.appendChild(el("p",null,t(x.d)));
    box.appendChild(el("span","who"+(x.moi?" moi":""), t(x.who)));
    i.appendChild(box);
    fl.appendChild(i);
  });
  s3.appendChild(fl);
  wrapH.appendChild(s3);

  /* ---- formules ---- */
  var s4 = el("section","hsec");
  s4.appendChild(el("h2",null,t(H.tarH)));
  s4.appendChild(el("p","sub",t(H.tarS)));
  var of = el("div","offers");
  of.appendChild(offerCard("A", true));
  of.appendChild(offerCard("B", true));
  s4.appendChild(of);
  wrapH.appendChild(s4);

  /* ---- à préparer ---- */
  var s5 = el("section","hsec");
  s5.appendChild(el("h2",null,t(H.needH)));
  s5.appendChild(el("p","sub",t(H.needS)));
  var ul = el("ul","need-l");
  H.need.forEach(function(x){ var li=document.createElement("li"); li.innerHTML=t(x); ul.appendChild(li); });
  s5.appendChild(ul);
  wrapH.appendChild(s5);

  /* ---- appel final ---- */
  var s6 = el("section","hsec");
  var ce = el("div","cta-end");
  ce.appendChild(el("h2",null,t(H.endH)));
  ce.appendChild(el("p",null,t(H.endP)));
  var r2 = el("div","row2");
  var b3 = el("button","btn prim big", hasDraft() ? t(H.resume) + " →" : t(H.start) + " →");
  b3.type="button"; b3.id="home_start2";
  b3.addEventListener("click", enterForm);
  r2.appendChild(b3);
  var b4 = document.createElement("a");
  b4.className="btn sec big"; b4.target="_blank"; b4.rel="noopener";
  b4.href = a2.href; b4.textContent = t(H.callme);
  r2.appendChild(b4);
  ce.appendChild(r2);
  s6.appendChild(ce);

  var ft = el("div","hfoot");
  ft.appendChild(el("span",null,t(H.footNote)));
  ft.appendChild(el("span","sp2"));
  var C = window.CR_CONFIG || {};
  var fw = document.createElement("a"); fw.href = waHref(""); fw.target="_blank"; fw.rel="noopener";
  fw.textContent = "WhatsApp +33 7 45 28 18 28"; ft.appendChild(fw);
  var fm = document.createElement("a"); fm.href = "mailto:"+(C.EMAIL||"comptarapide.com@gmail.com");
  fm.textContent = C.EMAIL||"comptarapide.com@gmail.com"; ft.appendChild(fm);
  s6.appendChild(ft);
  wrapH.appendChild(s6);

  host.appendChild(wrapH);
}

function enterForm(){
  VIEW = "form";
  stepIdx = 0; if(maxStep < 0) maxStep = 0;
  rerender();
  window.scrollTo({top:0,behavior:"auto"});
}
function backHome(){
  VIEW = "home";
  rerender();
  window.scrollTo({top:0,behavior:"auto"});
}

function panelConditions(host){
  host.appendChild(el("div","eyebrow", LANG==="fr"?"Étape 1 — à valider avant tout":"Adım 1 — her şeyden önce onaylanmalı"));
  host.appendChild(el("h2","h-step", LANG==="fr"?"Conditions de la mission":"Görev koşulları"));
  host.appendChild(el("p","lede", LANG==="fr"
    ? "Lisez ces conditions et choisissez votre formule. Tant qu’elles ne sont pas acceptées, le questionnaire reste fermé et aucun travail n’est engagé."
    : "Bu koşulları okuyun ve formülünüzü seçin. Kabul edilmediği sürece form kapalı kalır ve hiçbir çalışma başlatılmaz."));

  var of = el("div","offers");
  of.appendChild(offerCard("A", false));
  of.appendChild(offerCard("B", false));
  host.appendChild(of);

  var s = el("div","sect");
  s.appendChild(el("div","eyebrow", LANG==="fr"?"Dans les deux formules":"Her iki formülde de"));
  var card = el("div","card"); card.style.marginTop="10px";
  var terms = el("div","terms");
  var TT = LANG==="fr" ? [
    ["Les documents demandés dans ce questionnaire sont nécessaires au <b>dépôt de capital</b>. Sans eux, la banque ne délivre pas l’attestation."],
    ["Le <b>solde du paiement</b> est dû au moment où vous m’envoyez votre attestation de dépôt de capital reçue de votre banque. <b>Sans ces paiements, aucune formalité n’est déposée.</b>"],
    ["Les frais d’<b>annonce légale</b> et les frais d’<b>INPI</b> sont des frais officiels versés à des tiers. Ils ne sont ni des honoraires, ni remboursables une fois engagés."],
    ["Si vous n’acceptez pas ces conditions, <b>aucun travail ne sera commencé</b>. Ce n’est pas négociable."]
  ] : [
    ["Bu formda istenen belgeler <b>sermaye yatırımı</b> için gereklidir. Bunlar olmadan banka belgeyi düzenlemez."],
    ["<b>Ödeme bakiyesi</b>, bankanızdan aldığınız sermaye yatırım belgesini bana gönderdiğiniz anda muaccel olur. <b>Bu ödemeler yapılmadan hiçbir işlem yapılmaz.</b>"],
    ["<b>Resmî ilan</b> ve <b>INPI</b> masrafları üçüncü kişilere ödenen resmî masraflardır. Ne ücrettir ne de yapıldıktan sonra iade edilir."],
    ["Bu koşulları kabul etmezseniz <b>hiçbir çalışma başlatılmaz</b>. Bu pazarlığa açık değildir."]
  ];
  TT.forEach(function(x,i){
    var row = el("div","term");
    row.appendChild(el("div","n", String(i+1)));
    var xx = el("div","x"); xx.innerHTML = x[0]; row.appendChild(xx);
    terms.appendChild(row);
  });
  card.appendChild(terms);
  var m = el("div","motto");
  m.appendChild(el("p", null, LANG==="fr" ? "« Je suis payé, alors je fais mon travail. Sinon, je ne le ferai pas. »" : "« Ödemem yapılır, işimi yaparım. Aksi hâlde yapmam. »"));
  m.appendChild(el("div","sig", LANG==="fr"?"La seule condition, non négociable":"Tek koşul, pazarlıksız"));
  card.appendChild(m);
  s.appendChild(card);

  var hlp = el("div","note info"); hlp.style.marginTop="14px";
  var waU = waHref(LANG==="fr" ? "Bonjour Abdou, j’ai une question sur les conditions de la création." : "Merhaba Abdou, kuruluş koşulları hakkında bir sorum var.");
  hlp.innerHTML = (LANG==="fr"
    ? "Une question sur ces conditions, ou envie que je remplisse ce questionnaire avec vous ? <a href=\""+waU+"\" target=\"_blank\" rel=\"noopener\">Écrivez-moi sur WhatsApp</a> — cela ne change rien au tarif."
    : "Bu koşullar hakkında sorunuz mu var, ya da formu sizinle birlikte doldurmamı mı istersiniz? <a href=\""+waU+"\" target=\"_blank\" rel=\"noopener\">WhatsApp’tan yazın</a> — ücret değişmez.");
  s.appendChild(hlp);
  host.appendChild(s);

  var acc = el("div","sect");
  var lab = el("label","check"+(D.ans.accept?" lit":""));
  var ci = document.createElement("input"); ci.type="checkbox"; ci.id="accept_conditions"; ci.checked = !!D.ans.accept;
  var tx = el("div","t");
  tx.innerHTML = LANG==="fr"
    ? "<b>J’ai lu et j’accepte ces conditions, y compris la formule que j’ai sélectionnée ci-dessus.</b> Je comprends qu’aucune formalité ne sera déposée avant paiement, et que les frais d’annonce légale et d’INPI suivent la formule choisie."
    : "<b>Bu koşulları okudum ve yukarıda seçtiğim formül dâhil kabul ediyorum.</b> Ödeme yapılmadan hiçbir işlemin sunulmayacağını ve resmî ilan ile INPI masraflarının seçilen formüle tabi olduğunu anlıyorum.";
  ci.addEventListener("change",function(){ D.ans.accept = ci.checked; save(); rerender(); });
  lab.appendChild(ci); lab.appendChild(tx);
  acc.appendChild(lab);
  if(!D.ans.formule){
    var w = el("div","note warn"); w.style.marginTop="10px";
    w.innerHTML = LANG==="fr" ? "Choisissez d’abord la <b>Formule A</b> ou la <b>Formule B</b> ci-dessus." : "Önce yukarıdan <b>A</b> veya <b>B</b> formülünü seçin.";
    acc.appendChild(w);
  }
  host.appendChild(acc);
}

function panelAssocies(host){
  host.appendChild(el("div","eyebrow", LANG==="fr"?"Étape 4":"Adım 4"));
  host.appendChild(el("h2","h-step", LANG==="fr"?"Les autres associés":"Diğer ortaklar"));
  var solo = soloForm();
  host.appendChild(el("p","lede", solo
    ? (LANG==="fr" ? "Vous avez choisi une "+(D.ans.forme||"société unipersonnelle")+", qui ne compte qu’un seul associé. Cette étape est donc vide : passez à la suivante. Si vous voulez finalement plusieurs associés, revenez à l’étape « La société » et choisissez SARL ou SAS."
                   : (D.ans.forme||"tek kişilik şirket")+" seçtiniz; bu şirkette tek ortak bulunur. Bu adım boştur, bir sonrakine geçin. Birden fazla ortak isterseniz « Şirket » adımına dönüp SARL veya SAS seçin.")
    : (LANG==="fr" ? "Ajoutez une fiche par associé, en plus du dirigeant déjà saisi. Les informations de filiation servent à la Déclaration de Non-Condamnation, et le pourcentage de détention à la déclaration des bénéficiaires effectifs."
                   : "Halihazırda girilen yöneticiye ek olarak her ortak için bir kart ekleyin. Soybağı bilgileri Sabıkasızlık Beyanı, sahiplik yüzdesi ise gerçek faydalanıcı beyanı içindir.")));

  if(solo){
    var n = el("div","note info"); n.style.marginTop="18px";
    n.innerHTML = LANG==="fr" ? "Forme unipersonnelle sélectionnée : <b>"+esc(D.ans.forme||"")+"</b>. Aucun associé supplémentaire n’est attendu." : "Tek kişilik biçim seçildi: <b>"+esc(D.ans.forme||"")+"</b>. Ek ortak beklenmiyor.";
    host.appendChild(n);
    return;
  }

  var wrapEl = el("div"); wrapEl.style.marginTop="20px";
  D.people.forEach(function(_,i){
    var pre = "a"+i+"_";
    var p = el("div","person");
    var ph = el("div","person-h");
    ph.appendChild(el("div","idx", String(i+2)));
    var nm = ((D.ans[pre+"nom"]||"")+" "+(D.ans[pre+"prenoms"]||"")).trim();
    ph.appendChild(el("h4", null, nm || (LANG==="fr" ? "Associé n° "+(i+2) : (i+2)+". ortak")));
    var rm = el("button","btn-x", t(S.remove)); rm.type="button";
    rm.addEventListener("click", function(){
      var flds = personFields(pre,false);
      flds.forEach(function(f){ if(f.k) delete D.ans[f.k]; });
      D.people.splice(i,1);
      // re-index remaining answers
      var moved = {};
      for(var j=i;j<D.people.length;j++){
        personFields("a"+(j+1)+"_",false).forEach(function(f){
          if(!f.k) return;
          var oldK=f.k, newK=f.k.replace("a"+(j+1)+"_","a"+j+"_");
          if(D.ans[oldK]!=null){ moved[newK]=D.ans[oldK]; delete D.ans[oldK]; }
        });
      }
      Object.keys(moved).forEach(function(k){ D.ans[k]=moved[k]; });
      save(); rerender();
    });
    ph.appendChild(rm);
    p.appendChild(ph);
    var pb = el("div","person-b");
    renderFields(personFields(pre,false), pb);
    p.appendChild(pb);
    wrapEl.appendChild(p);
  });
  host.appendChild(wrapEl);

  var add = el("button","btn-ghost", t(S.addAssoc)); add.type="button"; add.id="add_assoc";
  add.addEventListener("click",function(){ D.people.push({}); save(); rerender(); });
  host.appendChild(add);

  if(D.people.length===0){
    var w2 = el("div","note warn"); w2.style.marginTop="14px";
    w2.innerHTML = LANG==="fr" ? "Une <b>"+esc(D.ans.forme||"SARL/SAS")+"</b> exige au moins deux associés. Ajoutez au minimum une fiche." : "Bir <b>"+esc(D.ans.forme||"SARL/SAS")+"</b> en az iki ortak gerektirir. En az bir kart ekleyin.";
    host.appendChild(w2);
  }
}

function panelDocuments(host){
  host.appendChild(el("div","eyebrow", LANG==="fr"?"Étape 6":"Adım 6"));
  host.appendChild(el("h2","h-step", LANG==="fr"?"Photographiez vos pièces justificatives":"Belgelerinizi fotoğraflayın"));
  host.appendChild(el("p","lede", LANG==="fr"
    ? "Prenez chaque document à plat, en lumière naturelle, sans ombre ni reflet, les quatre coins visibles. Une pièce illisible est rejetée par l’INPI et fait repartir le dossier à zéro."
    : "Her belgeyi düz bir zeminde, doğal ışıkta, gölge ve parlama olmadan, dört köşesi görünecek şekilde çekin. Okunmayan bir belge INPI tarafından reddedilir ve dosya baştan başlar."));

  var tip = el("div","note info"); tip.style.marginTop="18px";
  tip.innerHTML = LANG==="fr"
    ? "<b>Les photos sont réduites et conservées sur votre appareil</b> jusqu’à la génération du dossier à la dernière étape. Rien n’est envoyé automatiquement."
    : "<b>Fotoğraflar küçültülür ve son adımda dosya oluşturulana kadar cihazınızda saklanır.</b> Hiçbir şey otomatik olarak gönderilmez.";
  host.appendChild(tip);

  var grid = el("div","caps"); grid.style.marginTop="16px";
  docSlots().forEach(function(s){ grid.appendChild(captureCard(s,false)); });
  host.appendChild(grid);
}

function panelMentions(host){
  host.appendChild(el("div","eyebrow", LANG==="fr"?"Étape 7":"Adım 7"));
  host.appendChild(el("h2","h-step", LANG==="fr"?"Les mentions manuscrites":"El yazısı ibareler"));
  host.appendChild(el("p","lede", LANG==="fr"
    ? "Plusieurs documents de la constitution ne sont valables que s’ils portent une mention écrite de votre main, à côté de votre signature. Deux façons de faire, au choix."
    : "Kuruluş belgelerinin bir kısmı, ancak imzanızın yanında sizin elinizle yazılmış bir ibare taşırsa geçerlidir. İki yol vardır, seçim sizin."));

  var how = el("div","card"); how.style.marginTop="18px";
  var h1 = el("div","sect-h"); h1.appendChild(el("h3",null, LANG==="fr"?"Option 1 — vous les écrivez vous-même":"Seçenek 1 — kendiniz yazarsınız"));
  how.appendChild(h1);
  var p1 = el("div","note info");
  p1.innerHTML = LANG==="fr"
    ? "Je vous envoie les documents en PDF. Vous les <b>imprimez</b>, vous écrivez vous-même les mentions et vous signez, puis vous me les renvoyez scannés. Dans ce cas, vous n’avez rien à faire sur cette page : passez à l’étape suivante."
    : "Belgeleri PDF olarak gönderirim. Siz <b>yazdırır</b>, ibareleri kendi elinizle yazar ve imzalarsınız, sonra taranmış hâlde bana geri gönderirsiniz. Bu durumda bu sayfada yapacak bir şeyiniz yok: bir sonraki adıma geçin.";
  how.appendChild(p1);
  var h2 = el("div","sect-h"); h2.style.marginTop="16px";
  h2.appendChild(el("h3",null, LANG==="fr"?"Option 2 — je les insère pour vous":"Seçenek 2 — sizin yerinize ben yerleştiririm"));
  how.appendChild(h2);
  var p2 = el("div","note info");
  p2.innerHTML = LANG==="fr"
    ? "Si vous ne voulez ni imprimer ni insérer les mentions vous-même, vous m’en donnez l’<b>autorisation expresse</b> en cochant la case ci-dessous. Vous écrivez alors chaque mention sur une feuille blanche, vous la photographiez ici, et je l’insère à la bonne place dans chaque document."
    : "Yazdırmak veya ibareleri kendiniz eklemek istemiyorsanız, aşağıdaki kutuyu işaretleyerek bana <b>açık yetki</b> verirsiniz. Her ibareyi beyaz bir kâğıda yazar, burada fotoğraflarsınız; ben de her belgede doğru yere yerleştiririm.";
  how.appendChild(p2);
  host.appendChild(how);

  var s1 = el("div","sect");
  var l1 = el("label","check"+(D.ans.autorisation?" lit":""));
  var c1 = document.createElement("input"); c1.type="checkbox"; c1.id="autorisation_expresse"; c1.checked=!!D.ans.autorisation;
  var t1 = el("div","t");
  t1.innerHTML = LANG==="fr"
    ? "<b>Autorisation expresse.</b> J’autorise expressément COMPTARAPIDE à reporter, en mon nom et pour mon compte, les mentions manuscrites et ma signature sur les documents de constitution de ma société, à partir des photographies que je fournis ci-dessous. Cette autorisation vaut mandat exprès et me dispense d’imprimer et de remplir moi-même les documents."
    : "<b>Açık yetki.</b> Aşağıda sunduğum fotoğraflardan hareketle, şirketimin kuruluş belgelerine el yazısı ibareleri ve imzamı adıma ve hesabıma aktarması için COMPTARAPIDE’a açıkça yetki veriyorum. Bu yetki açık vekâlet niteliğindedir ve belgeleri kendim yazdırıp doldurma yükümlülüğümü ortadan kaldırır.";
  c1.addEventListener("change",function(){ D.ans.autorisation=c1.checked; if(!c1.checked) D.ans.usageTextes=false; save(); rerender(); });
  l1.appendChild(c1); l1.appendChild(t1);
  s1.appendChild(l1);

  var l2 = el("label","check"+(D.ans.usageTextes?" lit":"")); l2.style.marginTop="10px";
  var c2 = document.createElement("input"); c2.type="checkbox"; c2.id="conditions_usage_textes"; c2.checked=!!D.ans.usageTextes; c2.disabled = !D.ans.autorisation;
  var t2 = el("div","t");
  t2.innerHTML = LANG==="fr"
    ? "<b>Conditions d’utilisation des textes manuscrits et de la signature.</b> Je certifie être l’auteur des écritures et de la signature photographiées. J’accepte qu’elles soient reproduites <b>uniquement</b> sur les documents de constitution de ma société, pour cette formalité et pour aucune autre, conservées le temps du dossier, puis supprimées sur simple demande de ma part. Je reconnais que sans cette acceptation, je ne peux pas transmettre ces photographies."
    : "<b>El yazısı metinlerin ve imzanın kullanım koşulları.</b> Fotoğraflanan yazıların ve imzanın bana ait olduğunu beyan ederim. Bunların <b>yalnızca</b> şirketimin kuruluş belgelerinde, bu işlem için ve başka hiçbir amaçla kullanılmamak üzere çoğaltılmasını, dosya süresince saklanmasını ve talebim üzerine silinmesini kabul ederim. Bu kabul olmadan bu fotoğrafları iletemeyeceğimi biliyorum.";
  c2.addEventListener("change",function(){ D.ans.usageTextes=c2.checked; save(); rerender(); });
  l2.appendChild(c2); l2.appendChild(t2);
  s1.appendChild(l2);
  host.appendChild(s1);

  var locked = !(D.ans.autorisation && D.ans.usageTextes);

  var sec = el("div","sect");
  var sh = el("div","sect-h");
  sh.appendChild(el("h3",null, LANG==="fr"?"Les 4 mentions à écrire":"Yazılacak 4 ibare"));
  sh.appendChild(el("div","hint", LANG==="fr"?"Stylo noir ou bleu foncé, feuille blanche, une mention par feuille.":"Siyah veya koyu mavi kalem, beyaz kâğıt, her kâğıda bir ibare."));
  sec.appendChild(sh);

  if(locked){
    var lk = el("div","note warn");
    lk.innerHTML = LANG==="fr"
      ? "Les photos ne peuvent pas être transmises tant que les <b>deux cases ci-dessus</b> ne sont pas cochées. Si vous préférez écrire vous-même sur les documents imprimés, laissez cette section vide et passez à la suite."
      : "Yukarıdaki <b>iki kutu</b> işaretlenmeden fotoğraflar iletilemez. Basılı belgelere kendiniz yazmayı tercih ederseniz bu bölümü boş bırakıp devam edin.";
    sec.appendChild(lk);
  }

  mentionSlots().forEach(function(m){
    var box = el("div","mention");
    var tt = el("div","mention-t");
    tt.appendChild(el("div","q", "« "+m.txt+" »"));
    tt.appendChild(el("div","sub", t(m.sub)));
    box.appendChild(tt);
    var bb = el("div","mention-b");
    var g = el("div","caps");
    g.appendChild(captureCard({k:m.k, req:false, n:{fr:"Photo de la mention",tr:"İbarenin fotoğrafı"}, d:{fr:"Écrivez exactement le texte ci-dessus, puis photographiez la feuille.",tr:"Yukarıdaki metni birebir yazın, sonra kâğıdı fotoğraflayın."}}, locked));
    bb.appendChild(g);
    box.appendChild(bb);
    sec.appendChild(box);
  });
  host.appendChild(sec);
}

function panelSignature(host){
  host.appendChild(el("div","eyebrow", LANG==="fr"?"Étape 8":"Adım 8"));
  host.appendChild(el("h2","h-step", LANG==="fr"?"Votre signature et vos initiales":"İmzanız ve parafınız"));
  host.appendChild(el("p","lede", LANG==="fr"
    ? "Les statuts se signent page par page : la signature complète en fin d’acte, les initiales au bas de chaque page. Reportez-les sur une feuille blanche, bien détachées du bord."
    : "Ana sözleşme sayfa sayfa imzalanır: belgenin sonunda tam imza, her sayfanın altında paraf. Bunları beyaz bir kâğıda, kenarlardan uzak biçimde yazın."));

  var how = el("div","note info"); how.style.marginTop="18px";
  how.innerHTML = (LANG==="fr"
    ? "<b>Pour une reproduction nette :</b><ul><li>Feuille blanche unie, sans lignes ni carreaux.</li><li>Stylo noir ou bleu foncé, trait franc.</li><li>Photo prise bien au-dessus de la feuille, sans ombre portée.</li><li>Écrivez chaque élément 3 fois : je garderai le tracé le plus net.</li></ul>"
    : "<b>Net bir çoğaltma için:</b><ul><li>Çizgisiz, karesiz düz beyaz kâğıt.</li><li>Siyah veya koyu mavi kalem, belirgin çizgi.</li><li>Kâğıdın tam üstünden, gölge düşürmeden çekin.</li><li>Her öğeyi 3 kez yazın: en net olanı kullanacağım.</li></ul>");
  host.appendChild(how);

  var locked = !(D.ans.autorisation && D.ans.usageTextes);
  if(locked){
    var lk = el("div","note warn"); lk.style.marginTop="12px";
    lk.innerHTML = LANG==="fr"
      ? "Ces photos ne sont transmissibles qu’avec l’<b>autorisation expresse</b> et l’acceptation des <b>conditions d’utilisation</b>, à l’étape précédente. Sinon, vous signerez vous-même les documents imprimés."
      : "Bu fotoğraflar yalnızca önceki adımdaki <b>açık yetki</b> ve <b>kullanım koşulları</b> onayı ile iletilebilir. Aksi hâlde basılı belgeleri kendiniz imzalarsınız.";
    host.appendChild(lk);
  }
  var g = el("div","caps"); g.style.marginTop="16px";
  signSlots().forEach(function(s){ g.appendChild(captureCard({k:s.k, req:false, n:s.n, d:s.d}, locked)); });
  host.appendChild(g);
}


/* ---------- carte de formule, partagée entre l'accueil et l'étape 1 ---------- */
var OFFERS = {
  A:{
    tag:{fr:"Formule A",tr:"A Formülü"},
    h:{fr:"Vous payez vous-même les frais officiels",tr:"Resmî masrafları kendiniz ödersiniz"},
    price:"500 €",
    sub:{fr:"d’honoraires, en deux versements",tr:"ücret, iki taksitte"},
    pay:[
      {n:{fr:"150 € minimum",tr:"En az 150 €"},
       t:{fr:"<b>À la commande.</b> C’est ce versement qui déclenche mon travail : je ne rédige rien avant de l’avoir reçu. Il couvre la rédaction de vos statuts et, si vous le demandez, le prévisionnel pour la banque. Vous pouvez verser davantage, cela réduit d’autant le solde.",
           tr:"<b>Sipariş anında.</b> İşimi başlatan ödeme budur: bu ödemeyi almadan hiçbir şey yazmam. Ana sözleşmenizin hazırlanmasını ve talep ederseniz banka öngörü tablosunu kapsar. Daha fazla ödeyebilirsiniz; bakiye o kadar azalır."}},
      {n:{fr:"Le solde, soit 350 €",tr:"Bakiye, yani 350 €"},
       t:{fr:"<b>Au moment où vous m’enverrez votre attestation de dépôt de capital reçue de votre banque.</b> Tant que ce solde n’est pas réglé, je ne publie pas l’annonce légale et je ne dépose rien à l’INPI. Le dossier reste prêt, mais il ne part pas.",
           tr:"<b>Bankanızdan aldığınız sermaye yatırım belgesini bana gönderdiğiniz anda.</b> Bu bakiye ödenmediği sürece resmî ilanı yayımlamam ve INPI’ye hiçbir şey sunmam. Dosya hazır bekler ama gönderilmez."}}
    ],
    warn:{fr:"<b>En plus des 500 € d’honoraires :</b> l’annonce légale et les frais d’INPI restent à votre charge et se paient avec <b>votre</b> carte bancaire, au moment où ils sont dus. Ce ne sont pas mes honoraires — cet argent va au journal d’annonces légales et à l’INPI.",
          tr:"<b>500 € ücrete ek olarak:</b> resmî ilan ve INPI masrafları size aittir ve vadesi geldiğinde <b>sizin</b> kredi kartınızla ödenir. Bunlar benim ücretim değildir — bu para resmî ilan gazetesine ve INPI’ye gider."}
  },
  B:{
    tag:{fr:"Formule B",tr:"B Formülü"},
    h:{fr:"J’avance tous les frais à votre place",tr:"Tüm masrafları sizin yerinize ben karşılarım"},
    price:"1 500 €",
    sub:{fr:"tout compris, payés d’avance en une seule fois",tr:"her şey dâhil, tek seferde ve peşin"},
    pay:[
      {n:{fr:"1 500 €",tr:"1 500 €"},
       t:{fr:"<b>En une seule fois, avant que je commence.</b> Aucun échelonnement dans cette formule : c’est la contrepartie du fait que j’avance l’argent des frais officiels.",
           tr:"<b>Tek seferde, ben başlamadan önce.</b> Bu formülde taksit yoktur: resmî masrafları benim karşılamamın karşılığı budur."}}
    ],
    list:[
      {fr:"Vous ne sortez jamais votre carte bancaire : l’annonce légale et les frais d’INPI sont payés avec la mienne.",tr:"Kredi kartınızı hiç çıkarmazsınız: resmî ilan ve INPI masrafları benim kartımla ödenir."},
      {fr:"Honoraires et frais officiels compris dans les 1 500 €. Rien d’autre ne vous sera demandé.",tr:"Ücret ve resmî masraflar 1 500 € içindedir. Sizden başka bir şey istenmez."},
      {fr:"Même travail, même suivi jusqu’au Kbis que dans la formule A.",tr:"A formülüyle aynı çalışma, Kbis’e kadar aynı takip."}
    ]
  }
};

function offerCard(letter, readonly){
  var o = OFFERS[letter];
  var box = document.createElement(readonly ? "div" : "label");
  box.className = "offer" + (readonly ? " ro" : "");
  if(!readonly){
    var inp = document.createElement("input");
    inp.type="radio"; inp.name="formule"; inp.value=letter; inp.id="formule_"+letter;
    if(D.ans.formule===letter) inp.checked=true;
    inp.addEventListener("change",function(){ D.ans.formule=letter; save(); rerender(); });
    box.appendChild(inp);
  }
  var oh = el("div","oh");
  oh.appendChild(el("div","tag", t(o.tag)));
  oh.appendChild(el("h4", null, t(o.h)));
  var pr = el("div","price", o.price);
  var sm = document.createElement("small"); sm.textContent = t(o.sub);
  pr.appendChild(sm); oh.appendChild(pr);
  box.appendChild(oh);

  var pay = el("div","pay"); pay.style.margin = "16px 18px 0";
  o.pay.forEach(function(p){
    var l = el("div","pay-l");
    l.appendChild(el("div","pay-n", t(p.n)));
    var tt = el("div","pay-t"); tt.innerHTML = t(p.t);
    l.appendChild(tt);
    pay.appendChild(l);
  });
  box.appendChild(pay);

  if(o.list){
    var ul = document.createElement("ul");
    o.list.forEach(function(x){ ul.appendChild(el("li",null,t(x))); });
    box.appendChild(ul);
  }
  if(o.warn){
    var w = el("div","warnline"); w.innerHTML = t(o.warn);
    if(!o.list) w.style.marginTop = "16px";
    box.appendChild(w);
  }
  return box;
}

/* ---------- recap ---------- */
function labelFor(k){
  for(var i=0;i<STEPS.length;i++){
    var st=STEPS[i]; if(!st.fields) continue;
    for(var j=0;j<st.fields.length;j++){ if(st.fields[j].k===k) return t(st.fields[j].l); }
  }
  return k;
}
function collectSummary(){
  var out = [];
  out.push({title:{fr:"Conditions acceptées",tr:"Kabul edilen koşullar"}, rows:[
    [{fr:"Formule choisie",tr:"Seçilen formül"}, D.ans.formule==="A" ? (LANG==="fr"?"A — 500 € en 2 fois, frais officiels à la charge du client":"A — 500 €, 2 taksit, resmî masraflar müşteride") : (LANG==="fr"?"B — 1 500 € payés d’avance, frais officiels avancés par Comptarapide":"B — 1 500 € peşin, resmî masraflar Comptarapide tarafından")],
    [{fr:"Conditions acceptées",tr:"Koşullar kabul edildi"}, D.ans.accept ? (LANG==="fr"?"Oui":"Evet") : (LANG==="fr"?"Non":"Hayır")],
    [{fr:"Autorisation d’insertion des mentions",tr:"İbare yerleştirme yetkisi"}, D.ans.autorisation ? (LANG==="fr"?"Accordée":"Verildi") : (LANG==="fr"?"Non accordée — le client imprime et écrit lui-même":"Verilmedi — müşteri kendisi yazdırıp yazacak")],
    [{fr:"Conditions d’utilisation des écritures",tr:"Yazıların kullanım koşulları"}, D.ans.usageTextes ? (LANG==="fr"?"Acceptées":"Kabul edildi") : (LANG==="fr"?"Non acceptées":"Kabul edilmedi")]
  ]});
  STEPS.forEach(function(st){
    if(!st.fields) return;
    var rows=[];
    st.fields.forEach(function(f){
      if(f.sep) return;
      if(f.show && !f.show()) return;
      var v = D.ans[f.k];
      if(v==null||String(v).trim()==="") return;
      rows.push([f.l, v]);
    });
    if(rows.length) out.push({title:st.h||st.nm, rows:rows});
  });
  if(!soloForm() && D.people.length){
    D.people.forEach(function(_,i){
      var pre="a"+i+"_", rows=[];
      personFields(pre,false).forEach(function(f){
        if(f.sep) return; if(f.show && !f.show()) return;
        var v=D.ans[f.k]; if(v==null||String(v).trim()==="") return;
        rows.push([f.l, v]);
      });
      if(rows.length) out.push({title:{fr:"Associé n° "+(i+2),tr:(i+2)+". ortak"}, rows:rows});
    });
  }
  return out;
}

function panelRecap(host){
  host.appendChild(el("div","eyebrow", LANG==="fr"?"Étape 9 — dernière":"Adım 9 — son"));
  host.appendChild(el("h2","h-step", LANG==="fr"?"Vérifiez, puis envoyez-moi le dossier":"Kontrol edin, sonra dosyayı bana gönderin"));
  host.appendChild(el("p","lede", LANG==="fr"
    ? "Relisez le récapitulatif. Le bouton ci-dessous rassemble vos réponses et toutes vos photos dans un seul fichier ZIP : enregistrez-le, puis envoyez-le-moi par WhatsApp ou par e-mail."
    : "Özeti gözden geçirin. Aşağıdaki düğme, cevaplarınızı ve tüm fotoğraflarınızı tek bir ZIP dosyasında toplar: kaydedin, sonra bana WhatsApp veya e-posta ile gönderin."));

  // completeness
  var miss = [];
  STEPS.forEach(function(st,i){
    if(st.custom==="conditions"){ if(!D.ans.formule||!D.ans.accept) miss.push(t(st.nm)); return; }
    if(st.fields){
      var bad=false;
      st.fields.forEach(function(f){ if(f.sep||!f.req) return; if(f.show&&!f.show()) return; var v=D.ans[f.k]; if(v==null||String(v).trim()==="") bad=true; });
      if(bad) miss.push(t(st.nm));
    }
    if(st.custom==="associes" && !soloForm() && D.people.length===0) miss.push(t(st.nm));
    if(st.custom==="documents"){
      var b2=false; docSlots().forEach(function(s){ if(s.req && !PHOTOS[s.k]) b2=true; });
      if(b2) miss.push(t(st.nm));
    }
  });
  var nPh = Object.keys(PHOTOS).length;
  var st1 = el("div", miss.length ? "note warn" : "note ok"); st1.style.marginTop="18px";
  st1.innerHTML = miss.length
    ? (LANG==="fr" ? "<b>Il manque encore quelque chose</b> dans : "+esc(miss.join(", "))+". Vous pouvez tout de même générer le dossier, mais je ne pourrai pas déposer la formalité tant que ces éléments manquent."
                   : "<b>Şu bölümlerde eksik var</b>: "+esc(miss.join(", "))+". Yine de dosyayı oluşturabilirsiniz, ancak bu eksikler tamamlanmadan işlemi sunamam.")
    : (LANG==="fr" ? "<b>Le questionnaire est complet.</b> "+nPh+" photo(s) jointe(s)." : "<b>Form eksiksiz.</b> "+nPh+" fotoğraf eklendi.");
  host.appendChild(st1);

  var sec = el("div","sect recap");
  collectSummary().forEach(function(bl){
    var c = el("div","card");
    var hh = el("div","sect-h"); hh.appendChild(el("h3",null,t(bl.title))); c.appendChild(hh);
    var dl = document.createElement("dl");
    bl.rows.forEach(function(r){
      dl.appendChild(el("dt",null,t(r[0])));
      dl.appendChild(el("dd",null,String(r[1])));
    });
    c.appendChild(dl); sec.appendChild(c);
  });
  var cP = el("div","card");
  var hp = el("div","sect-h"); hp.appendChild(el("h3",null, LANG==="fr"?"Photos jointes":"Eklenen fotoğraflar")); cP.appendChild(hp);
  var lst = el("div"); lst.style.display="flex"; lst.style.flexWrap="wrap"; lst.style.gap="7px";
  var allSlots = docSlots().concat(mentionSlots().map(function(m){return {k:m.k, n:{fr:"Mention : "+m.txt, tr:"İbare: "+m.txt}};})).concat(signSlots());
  allSlots.forEach(function(s){
    var nm = typeof s.n==="function"? s.n() : s.n;
    var p = el("span","pill "+(PHOTOS[s.k]?"ok":(s.req?"miss":"")));
    p.textContent = (PHOTOS[s.k]?"✓ ":"– ")+t(nm);
    lst.appendChild(p);
  });
  cP.appendChild(lst); sec.appendChild(cP);
  host.appendChild(sec);

  var act = el("div","sect");
  var ca = el("div","card");

  if(D.ans._sent && D.ans._sent.ref){
    var okb = el("div","note ok");
    okb.innerHTML = (LANG==="fr"
      ? "<b>Dossier envoyé le "+esc(D.ans._sent.at)+".</b><br>Votre référence : <b>"+esc(D.ans._sent.ref)+"</b>. Je l’ai bien reçu et je reviens vers vous. Conservez cette référence pour toute question."
      : "<b>Dosya "+esc(D.ans._sent.at)+" tarihinde gönderildi.</b><br>Referansınız: <b>"+esc(D.ans._sent.ref)+"</b>. Dosyanızı aldım, size döneceğim. Bu referansı saklayın.");
    ca.appendChild(okb);
  }

  var bigrow = el("div"); bigrow.style.display="flex"; bigrow.style.flexWrap="wrap"; bigrow.style.gap="10px";

  var bSend = el("button","btn prim", D.ans._sent && D.ans._sent.ref
    ? (LANG==="fr"?"Renvoyer le dossier mis à jour":"Güncellenen dosyayı yeniden gönder")
    : t(S.send));
  bSend.type="button"; bSend.id="btn_send";
  bSend.addEventListener("click", function(){ sendDossier(bSend); });
  bigrow.appendChild(bSend);

  var bZip = el("button","btn sec", t(S.zipBackup));
  bZip.type="button"; bZip.id="btn_zip";
  bZip.addEventListener("click", function(){ makeZip(bZip); });
  bigrow.appendChild(bZip);

  var bCopy = el("button","btn sec", LANG==="fr"?"Copier le récapitulatif":"Özeti kopyala");
  bCopy.type="button"; bCopy.id="btn_copy";
  bCopy.addEventListener("click", function(){
    var txt = plainSummary();
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){ toast(LANG==="fr"?"Récapitulatif copié":"Özet kopyalandı"); },function(){ toast(LANG==="fr"?"Copie impossible":"Kopyalanamadı"); });
    } else toast(LANG==="fr"?"Copie impossible sur ce navigateur":"Bu tarayıcıda kopyalanamıyor");
  });
  bigrow.appendChild(bCopy);
  ca.appendChild(bigrow);

  var prog = el("div","sendprog"); prog.id="sendprog"; prog.hidden = true;
  prog.appendChild(el("div","sendprog-t","")); 
  var bar = el("div","sendprog-bar"); bar.appendChild(el("i")); prog.appendChild(bar);
  ca.appendChild(prog);

  var nt = el("div","note info"); nt.style.marginTop="14px";
  nt.innerHTML = LANG==="fr"
    ? "Le bouton d’envoi transmet directement vos réponses et vos photos, de façon chiffrée. Vous recevez une <b>référence de dossier</b> à conserver. Le bouton « copie » n’est utile que si vous souhaitez garder une trace de votre côté."
    : "Gönder düğmesi, cevaplarınızı ve fotoğraflarınızı doğrudan ve şifreli olarak iletir. Saklamanız için bir <b>dosya referansı</b> alırsınız. « Kopya » düğmesi yalnızca kendinizde bir kayıt tutmak isterseniz gereklidir.";
  ca.appendChild(nt);

  var send = el("div"); send.style.marginTop="16px"; send.style.display="flex"; send.style.flexWrap="wrap"; send.style.gap="10px"; send.style.alignItems="center";
  send.appendChild(el("span","hint2", LANG==="fr"?"Une question ?":"Sorunuz mu var?"));
  var CFG = window.CR_CONFIG||{};
  var wa = document.createElement("a");
  wa.className="btn sec"; wa.target="_blank"; wa.rel="noopener";
  wa.href = "https://wa.me/"+(CFG.WHATSAPP||"33745281828")+"?text="+encodeURIComponent((LANG==="fr"?"Bonjour, au sujet de mon dossier de création : ":"Merhaba, kuruluş dosyam hakkında: ")+(D.ans.denom||""));
  wa.textContent = "WhatsApp";
  wa.style.textDecoration="none";
  send.appendChild(wa);
  var ml = document.createElement("a");
  ml.className="btn sec";
  ml.href = "mailto:"+(CFG.EMAIL||"comptarapide.com@gmail.com")+"?subject="+encodeURIComponent((LANG==="fr"?"Dossier création — ":"Kuruluş dosyası — ")+(D.ans.denom||""));
  ml.textContent = CFG.EMAIL||"comptarapide.com@gmail.com";
  ml.style.textDecoration="none";
  send.appendChild(ml);
  ca.appendChild(send);

  act.appendChild(ca);
  host.appendChild(act);

  var reset = el("div","sect");
  var rb = el("button","btn-x", LANG==="fr"?"Effacer toutes mes données de cet appareil":"Bu cihazdaki tüm verilerimi sil");
  rb.type="button"; rb.id="btn_reset";
  rb.addEventListener("click", function(){
    if(!confirm(LANG==="fr"?"Effacer définitivement vos réponses et vos photos de cet appareil ?":"Cevaplarınız ve fotoğraflarınız bu cihazdan kalıcı olarak silinsin mi?")) return;
    try{ localStorage.removeItem("cr_data"); }catch(e){}
    Object.keys(PHOTOS).forEach(function(k){ delPhoto(k); });
    PHOTOS={}; D={meta:{v:3,started:new Date().toISOString()},ans:{},people:[],docs:{}};
    stepIdx=0; maxStep=0; rerender(); window.scrollTo(0,0);
  });
  reset.appendChild(rb);
  host.appendChild(reset);
}

/* ============================ export ============================ */
function plainSummary(){
  var L=[];
  L.push("DOSSIER DE CRÉATION DE SOCIÉTÉ — COMPTARAPIDE");
  L.push("Généré le "+todayFR());
  L.push("");
  collectSummary().forEach(function(b){
    L.push("== "+t(b.title).toUpperCase()+" ==");
    b.rows.forEach(function(r){ L.push("  "+t(r[0])+" : "+r[1]); });
    L.push("");
  });
  var ph = Object.keys(PHOTOS);
  L.push("== PHOTOS ("+ph.length+") ==");
  ph.forEach(function(k){ L.push("  "+k+".jpg ("+Math.round(PHOTOS[k].bytes/1024)+" Ko)"); });
  return L.join("\n");
}
function recapHTML(){
  var h = [];
  h.push('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Dossier — '+esc(D.ans.denom||"")+'</title>');
  h.push('<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#17110F;max-width:820px;margin:32px auto;padding:0 18px;line-height:1.5}h1{font-size:24px;margin:0 0 4px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:#D81A10;margin:26px 0 6px;border-bottom:2px solid #F5C4BF;padding-bottom:4px}dl{display:grid;grid-template-columns:38% 1fr;gap:0;margin:0}dt{color:#857673;font-size:12px;padding:6px 0;border-top:1px solid #E7DEDB}dd{margin:0;font-size:13.5px;padding:6px 0;border-top:1px solid #E7DEDB}.meta{color:#857673;font-size:12.5px}img{max-width:100%;border:1px solid #E7DEDB;border-radius:6px;margin:6px 0}figure{margin:0 0 18px}figcaption{font-size:12px;color:#857673;margin-bottom:4px;font-weight:700}@media print{h2{break-after:avoid}figure{break-inside:avoid}}</style></head><body>');
  h.push('<h1>'+esc(D.ans.denom||"Création de société")+'</h1>');
  h.push('<div class="meta">'+esc(D.ans.forme||"")+' — dossier transmis le '+todayFR()+' via le formulaire Comptarapide</div>');
  collectSummary().forEach(function(b){
    h.push('<h2>'+esc(t(b.title))+'</h2><dl>');
    b.rows.forEach(function(r){ h.push('<dt>'+esc(t(r[0]))+'</dt><dd>'+esc(String(r[1]))+'</dd>'); });
    h.push('</dl>');
  });
  var allSlots = docSlots().concat(mentionSlots().map(function(m){return {k:m.k, n:{fr:"Mention manuscrite : « "+m.txt+" »",tr:"İbare: « "+m.txt+" »"}};})).concat(signSlots());
  var any = allSlots.some(function(s){ return PHOTOS[s.k]; });
  if(any){
    h.push('<h2>Pièces photographiées</h2>');
    allSlots.forEach(function(s){
      if(!PHOTOS[s.k]) return;
      var nm = typeof s.n==="function"? s.n() : s.n;
      h.push('<figure><figcaption>'+esc(t(nm))+'</figcaption><img src="'+PHOTOS[s.k].dataUrl+'" alt=""></figure>');
    });
  }
  h.push('</body></html>');
  return h.join("");
}
function allNamedSlots(){
  var out = [];
  docSlots().forEach(function(x){
    var nm = typeof x.n==="function"? x.n() : x.n;
    out.push({k:x.k, label:t(nm), groupe:"piece"});
  });
  mentionSlots().forEach(function(m){ out.push({k:m.k, label:(LANG==="fr"?"Mention manuscrite : « ":"El yazısı ibare: « ")+m.txt+" »", groupe:"mention"}); });
  signSlots().forEach(function(x){ out.push({k:x.k, label:t(x.n), groupe:"signature"}); });
  return out;
}

function showProgress(txt, pct){
  var p = document.getElementById("sendprog"); if(!p) return;
  p.hidden = false;
  p.querySelector(".sendprog-t").textContent = txt;
  p.querySelector(".sendprog-bar i").style.width = Math.max(2,Math.min(100,pct))+"%";
}
function hideProgress(){ var p=document.getElementById("sendprog"); if(p) p.hidden=true; }

function sendDossier(btn){
  if(!window.CRDB || !CRDB.configured()){
    toast(LANG==="fr" ? "L’envoi n’est pas encore configuré. Utilisez la copie .zip." : "Gönderim henüz yapılandırılmadı. .zip kopyasını kullanın.");
    return;
  }
  if(!D.ans.formule || !D.ans.accept){
    toast(LANG==="fr"?"Acceptez d’abord les conditions (étape 1).":"Önce koşulları kabul edin (adım 1).");
    return;
  }
  var old = btn.textContent;
  btn.disabled = true; btn.textContent = t(S.sending);

  var id = (D.ans._draftId = D.ans._draftId || uuid());
  var ref = makeRef();
  var slots = allNamedSlots().filter(function(x){ return PHOTOS[x.k]; });
  var photos = [];
  var done = 0;

  function step(i){
    if(i >= slots.length) return Promise.resolve();
    var sl = slots[i];
    var name = String(i+1).padStart(2,"0")+"_"+slug(sl.label)+".jpg";
    var path = id+"/"+name;
    showProgress(t(S.sendPhotos)+" "+(i+1)+" / "+slots.length, (i/Math.max(1,slots.length))*85);
    return CRDB.uploadPhoto(path, dataUrlToBlob(PHOTOS[sl.k].dataUrl), "image/jpeg")
      .then(function(){
        photos.push({slot:sl.k, label:sl.label, groupe:sl.groupe, path:path, octets:PHOTOS[sl.k].bytes});
        done++;
        return step(i+1);
      });
  }

  step(0).then(function(){
    showProgress(LANG==="fr"?"Enregistrement du dossier…":"Dosya kaydediliyor…", 92);
    var row = {
      id: id,
      reference: ref,
      denomination: D.ans.denom || null,
      forme: D.ans.forme || null,
      formule: D.ans.formule || null,
      dirigeant_nom: ((D.ans.d_nom||"")+" "+(D.ans.d_prenoms||"")).trim() || null,
      dirigeant_email: D.ans.d_email || null,
      dirigeant_tel: D.ans.d_tel || null,
      lang: LANG,
      autorisation: !!D.ans.autorisation,
      usage_textes: !!D.ans.usageTextes,
      nb_photos: photos.length,
      reponses: buildAnswerPayload(),
      photos: photos
    };
    return CRDB.insertDossier(row);
  }).then(function(){
    showProgress(t(S.sentOK), 100);
    D.ans._sent = {ref:ref, at:todayFR()};
    D.ans._draftId = uuid();   // un renvoi créera un nouveau dossier
    save();
    setTimeout(function(){ hideProgress(); rerender(); window.scrollTo({top:0,behavior:"smooth"}); }, 500);
    toast((LANG==="fr"?"Dossier envoyé — référence ":"Dosya gönderildi — referans ")+ref);
  }).catch(function(e){
    hideProgress();
    btn.disabled=false; btn.textContent=old;
    var m = (e && e.message) || "";
    toast(LANG==="fr"
      ? "Échec de l’envoi"+(m?" : "+m:"")+". Réessayez, ou envoyez-moi la copie .zip."
      : "Gönderim başarısız"+(m?": "+m:"")+". Tekrar deneyin veya .zip kopyasını gönderin.");
  });
}

// Réponses mises à plat, avec les libellés lisibles, pour l'espace admin.
function buildAnswerPayload(){
  var out = {_sections:[]};
  collectSummary().forEach(function(b){
    var sec = {titre: t(b.title), lignes: []};
    b.rows.forEach(function(r){ sec.lignes.push({label:t(r[0]), valeur:String(r[1])}); });
    out._sections.push(sec);
  });
  out._brut = {};
  Object.keys(D.ans).forEach(function(k){ if(k.charAt(0)!=="_") out._brut[k]=D.ans[k]; });
  out._nb_associes = soloForm() ? 0 : D.people.length;
  return out;
}

function makeZip(btn){
  if(typeof JSZip==="undefined"){ toast(LANG==="fr"?"Module d’archivage indisponible":"Arşiv modülü kullanılamıyor"); return; }
  var old = btn.textContent;
  btn.disabled = true; btn.textContent = LANG==="fr"?"Préparation…":"Hazırlanıyor…";
  try{
    var zip = new JSZip();
    var base = "COMPTARAPIDE_"+slug(D.ans.denom||"dossier");
    zip.file("RECAPITULATIF.html", recapHTML());
    zip.file("reponses.txt", plainSummary());
    zip.file("reponses.json", JSON.stringify({meta:D.meta, generatedAt:new Date().toISOString(), answers:D.ans, associes:D.people.length}, null, 2));
    var folder = zip.folder("PHOTOS");
    var allSlots = docSlots().concat(mentionSlots().map(function(m){return {k:m.k, n:{fr:"mention_"+slug(m.txt),tr:"mention_"+slug(m.txt)}};})).concat(signSlots());
    var idx = 1;
    allSlots.forEach(function(s){
      if(!PHOTOS[s.k]) return;
      var nm = typeof s.n==="function"? s.n() : s.n;
      var fn = String(idx).padStart(2,"0")+"_"+slug(t(nm))+".jpg"; idx++;
      folder.file(fn, PHOTOS[s.k].dataUrl.split(",")[1], {base64:true});
    });
    zip.generateAsync({type:"blob", compression:"DEFLATE", compressionOptions:{level:4}}).then(function(blob){
      btn.textContent = LANG==="fr"?"Enregistrement…":"Kaydediliyor…";
      try{
        var u = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = u; a.download = base+".zip";
        document.body.appendChild(a); a.click();
        setTimeout(function(){ URL.revokeObjectURL(u); a.remove(); }, 1500);
        btn.disabled=false; btn.textContent=old;
        toast(LANG==="fr"?"Copie enregistrée sur votre appareil.":"Kopya cihazınıza kaydedildi.");
      }catch(e3){
        btn.disabled=false; btn.textContent=old;
        toast(LANG==="fr"?"Impossible d’enregistrer le fichier":"Dosya kaydedilemedi");
      }
    }).catch(function(){ btn.disabled=false; btn.textContent=old; toast(LANG==="fr"?"Erreur lors de la création du ZIP":"ZIP oluşturulurken hata"); });
  }catch(e){ btn.disabled=false; btn.textContent=old; toast(LANG==="fr"?"Erreur lors de la création du ZIP":"ZIP oluşturulurken hata"); }
}

/* ============================ nav & render ============================ */
function stepAllowed(i){ return i<=maxStep; }
function canLeave(i, host){
  var st = STEPS[i];
  if(st.custom==="conditions"){
    if(!D.ans.formule || !D.ans.accept){ toast(LANG==="fr"?"Choisissez une formule et acceptez les conditions.":"Bir formül seçin ve koşulları kabul edin."); return false; }
    return true;
  }
  if(st.fields) return validateFields(st.fields, host) || (toast(t(S.fixErrors)), false);
  if(st.custom==="associes"){
    if(soloForm()) return true;
    if(D.people.length===0){ toast(LANG==="fr"?"Ajoutez au moins un associé supplémentaire.":"En az bir ek ortak ekleyin."); return false; }
    var ok=true;
    D.people.forEach(function(_,j){ if(!validateFields(personFields("a"+j+"_",false), host)) ok=false; });
    if(!ok) toast(t(S.fixErrors));
    return ok;
  }
  if(st.custom==="documents"){
    var missing = docSlots().filter(function(s){ return s.req && !PHOTOS[s.k]; });
    if(missing.length){
      if(!confirm(LANG==="fr"
        ? "Il manque "+missing.length+" pièce(s) obligatoire(s). Continuer quand même et les ajouter plus tard ?"
        : missing.length+" zorunlu belge eksik. Yine de devam edilsin ve sonra eklensin mi?")) return false;
    }
    return true;
  }
  return true;
}

function renderRail(){
  var rail = $("rail"); rail.innerHTML="";
  STEPS.forEach(function(st,i){
    var b = el("button","rail-item"+(i<stepIdx?" done":"")); b.type="button";
    b.setAttribute("aria-current", i===stepIdx ? "true":"false");
    b.disabled = !stepAllowed(i);
    var d = el("div","dot", i<stepIdx ? "✓" : String(i+1));
    b.appendChild(d); b.appendChild(el("div","nm", t(st.nm)));
    b.addEventListener("click", function(){ if(!stepAllowed(i)) return; goTo(i); });
    rail.appendChild(b);
  });
  var f = el("div","rail-foot");
  f.innerHTML = (LANG==="fr"
    ? "Questions ?<br>WhatsApp <b>+33 7 45 28 18 28</b><br>comptarapide.com@gmail.com"
    : "Sorular?<br>WhatsApp <b>+33 7 45 28 18 28</b><br>comptarapide.com@gmail.com");
  rail.appendChild(f);
}

function rerender(){
  var host = $("panels"); host.innerHTML="";

  if(VIEW === "home"){
    document.body.classList.add("on-home");
    var ph = el("div","panel on");
    panelHome(ph);
    host.appendChild(ph);
    $("rail").innerHTML = "";
    $("mobstep").textContent = "";
    $("pbar").style.width = "0%";
    return;
  }
  document.body.classList.remove("on-home");

  var st = STEPS[stepIdx];
  var p = el("div","panel on");
  if(st.custom==="conditions") panelConditions(p);
  else if(st.custom==="associes") panelAssocies(p);
  else if(st.custom==="documents") panelDocuments(p);
  else if(st.custom==="mentions") panelMentions(p);
  else if(st.custom==="signature") panelSignature(p);
  else if(st.custom==="recap") panelRecap(p);
  else {
    p.appendChild(el("div","eyebrow", t(st.eyebrow)));
    p.appendChild(el("h2","h-step", t(st.h)));
    p.appendChild(el("p","lede", t(st.lede)));
    var box = el("div","card"); box.style.marginTop="20px";
    renderFields(st.fields, box);
    p.appendChild(box);
  }
  host.appendChild(p);
  renderRail();
  $("mobstep").textContent = (stepIdx+1)+" / "+STEPS.length+" · "+t(st.nm);
  $("pbar").style.width = Math.round((stepIdx/(STEPS.length-1))*100)+"%";
  $("btn-prev").disabled = false;
  $("btn-prev").textContent = stepIdx===0 ? "← "+t(S.home) : "← "+t(S.prev);
  var last = stepIdx===STEPS.length-1;
  $("btn-next").textContent = last ? (LANG==="fr"?"Terminé":"Bitti") : t(S.next)+" →";
  $("btn-next").disabled = last;
  $("navstat").textContent = t(st.nm)+" — "+(LANG==="fr"?"étape":"adım")+" "+(stepIdx+1)+" "+(LANG==="fr"?"sur":"/")+" "+STEPS.length;
}

(function(){
  var logos = document.querySelectorAll(".topbar .logo");
  Array.prototype.forEach.call(logos, function(l){
    l.style.cursor = "pointer";
    l.title = "Accueil";
    l.addEventListener("click", backHome);
  });
})();

function goTo(i){ stepIdx=i; if(i>maxStep) maxStep=i; rerender(); window.scrollTo({top:0,behavior:"smooth"}); }

$("btn-next").addEventListener("click", function(){
  if(stepIdx>=STEPS.length-1) return;
  if(!canLeave(stepIdx, $("panels"))) return;
  goTo(stepIdx+1); save();
});
$("btn-prev").addEventListener("click", function(){ if(stepIdx>0) goTo(stepIdx-1); else backHome(); });

function setLang(l){
  LANG=l; try{ localStorage.setItem("cr_lang",l); }catch(e){}
  $("lang-fr").setAttribute("aria-pressed", l==="fr");
  $("lang-tr").setAttribute("aria-pressed", l==="tr");
  document.documentElement.lang = l;
  rerender();
}
$("lang-fr").addEventListener("click",function(){ setLang("fr"); });
$("lang-tr").addEventListener("click",function(){ setLang("tr"); });

/* ============================ boot ============================ */
load();
openIDB(function(){
  loadPhotos(function(){
    // resume at the furthest sensible step
    if(D.ans.accept && D.ans.formule) maxStep = Math.max(maxStep, 1);
    if(D.ans.denom) maxStep = Math.max(maxStep, 2);
    if(D.ans.d_nom) maxStep = Math.max(maxStep, 4);
    if(window.CR_DEMO) maxStep = STEPS.length - 1;   // aperçu : toutes les étapes accessibles
    VIEW = "home";
    setLang(LANG);
  });
});
})();
