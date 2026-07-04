// Pre-deduplicated and pre-filtered at authoring time (this used to be a
// runtime [...new Set(WORDS)] over a raw list with real duplicates in it
// -- e.g. "AXMAQ", "ASİYA"/"AŞİNA" appeared twice -- re-deduped on every
// page load for no reason). Kept in the exact same order as the
// sozle_answers seed migration in the sozle-supabase repo, since the daily
// word index is order-dependent.
const WORD_LIST = ["ABBAS", "ABBAT", "ABORT", "ABRİX", "ABUNƏ", "ABXAZ", "ABZAS", "ABİDƏ", "ACGÖZ", "ACILI", "ACIMA", "ACINA", "ACLIQ", "ACMAQ", "ACİKA", "ADALI", "ADANA", "ADDIM", "ADINA", "ADLIQ", "ADRES", "ADSIZ", "ADYAL", "ADİCƏ", "AFİNA", "AFİŞA", "AGENT", "AHƏNG", "AKKAD", "AKRİL", "AKSİZ", "AKTAU", "AKTİV", "AKULA", "ALACA", "ALBAN", "ALBOM", "ALICI", "ALLAH", "ALLIQ", "ALMAN", "ALMAQ", "ALMAZ", "ALQIŞ", "ALTAR", "ALTIN", "ALKAŞ", "ALTUN", "ALUDƏ", "ALVER", "ALÇAQ", "ALİBİ", "AMORF", "AMPEL", "AMPER", "AMPUL", "ANBAR", "ANCAQ", "ANDIR", "ANDÇI", "ANKER", "ANKET", "ANLAM", "ANLIQ", "ANMAQ", "ANONS", "ANQAR", "ANQUT", "ANSIZ", "ANTEN", "ANTİK", "ANÇAR", "ANİON", "AORTA", "APAÇİ", "APEKS", "APREL", "APTEK", "AQAVA", "AQRAR", "ARABA", "ARALI", "ARAMA", "ARAMİ", "ARASI", "ARAYA", "ARAÇI", "ARDIC", "AREAL", "ARENA", "ARIMA", "ARINA", "ARIÇI", "ARKOZ", "ARMUD", "ARPAD", "ARQAN", "ARQON", "ARSEN", "ARSIZ", "ARSİN", "ARTAN", "ARTEL", "ARTIM", "ARTIQ", "ARTMA", "ARVAD", "ARXAC", "ARXAR", "ARXİV", "ARÇAN", "ARĞAC", "ARĞAZ", "ARĞIN", "ARİYA", "ARŞIN", "ASICI", "ASILA", "ASILI", "ASKET", "ASLAN", "ASMAQ", "ASPİD", "ASRAL", "ASSUR", "ASTAF", "ASTAR", "ASTEK", "ASTMA", "ASTRA", "ASUDƏ", "ASİYA", "ATALI", "ATBAZ", "ATCIL", "ATICI", "ATILA", "ATIŞA", "ATLAS", "ATLAZ", "ATLET", "ATMAQ", "ATTİK", "AUDİO", "AUDİT", "AVAND", "AVANS", "AVARA", "AVERS", "AVRAL", "AVTOL", "AVTOŞ", "AVUAR", "AVİZO", "AVŞAR", "AXICI", "AXIRI", "AXMAQ", "AXMAZ", "AXSAQ", "AXSAR", "AXUND", "AXURA", "AXŞAM", "AYGÜN", "AYAĞA", "AYDAN", "AYDIN", "AYIRD", "AYLAM", "AYLIQ", "AYOVA", "AYRAN", "AYRIC", "AYRIM", "AYRIQ", "AYSIZ", "AYSOR", "AYĞIR", "AZADƏ", "AZDAN", "AZLIQ", "AZMAN", "AZMAQ", "AZMIŞ", "AZUQƏ", "AZĞIN", "AZƏRİ", "AÇICI", "AÇILI", "AÇIĞA", "AÇMAQ", "AÇMAZ", "AĞALI", "AĞBAN", "AĞBAŞ", "AĞBIĞ", "AĞDAM", "AĞDAŞ", "AĞDİŞ", "AĞGÖL", "AĞGÖZ", "AĞGÜN", "AĞLAR", "AĞLIQ", "AĞNAQ", "AĞSAÇ", "AĞSOL", "AĞTÜK", "AĞYAL", "AĞYOL", "AĞÇAĞ", "AĞŞIN", "AŞAĞI", "AŞILI", "AŞİNA", "AŞIRI", "AŞKAR", "AŞLIQ", "AŞMAQ", "AŞPAZ", "AŞQAL", "AŞQAR", "AŞSIZ", "AŞURA", "BABAL", "BABAT", "BABƏK", "BACAQ", "BADAM", "BADAQ", "BADYA", "BAFTA", "BAĞIR", "BAHAM", "BAHAR", "BAHƏM", "BAKAL", "BAKİR", "BALAQ", "BALBA", "BALET", "BALIQ", "BALIŞ", "BALKA", "BALLI", "BALON", "BALTA", "BALUN", "BALÇI", "BANAL", "BANAN", "BANCO", "BANDA", "BANKA", "BANKƏ", "BANTU", "BAQAJ", "BARAK", "BARAT", "BAREL", "BARIT", "BARIŞ", "BARLI", "BARON", "BARİT", "BARİZ", "BASIB", "BASIM", "BASIQ", "BASMA", "BASQI", "BASİL", "BATAK", "BATAL", "BATAN", "BATAQ", "BATAT", "BATIL", "BATIQ", "BATIŞ", "BATMA", "BATON", "BATOR", "BATQI", "BATUT", "BATİL", "BATİN", "BAXAR", "BAXIM", "BAXIŞ", "BAXMA", "BAXTA", "BAXYA", "BAXİL", "BAYAN", "BAYAQ", "BAYAT", "BAYAZ", "BAYIR", "BAYKA", "BAZAR", "BAZİS", "BAĞAM", "BAĞAT", "BAĞLI", "BAĞÇA", "BAĞÇI", "BAŞAQ", "BAŞLA", "BAŞLI", "BAŞQA", "BAŞÇI", "BECİD", "BEHLİ", "BEKON", "BELAN", "BELLİ", "BEMBA", "BEMOL", "BEMİT", "BENUE", "BENİN", "BERET", "BERİL", "BETON", "BETƏR", "BEYZA", "BEYİN", "BEYƏT", "BEZAR", "BEZMƏ", "BEZİK", "BEŞCƏ", "BEŞLİ", "BEŞİK", "BILIX", "BIÇAQ", "BIÇQI", "BIĞIR", "BIĞLI", "BLANK", "BLANŞ", "BLOKU", "BLİND", "BLİNK", "BLİTS", "BOLLU", "BOLİD", "BOMBA", "BONUS", "BONZA", "BORAN", "BORAT", "BOTEL", "BOYAQ", "BOYAR", "BOYAT", "BOYLU", "BOYUN", "BOZAQ", "BOZAX", "BOZAY", "BOZCA", "BOZLU", "BOZON", "BOĞAZ", "BOĞMA", "BOĞUQ", "BOĞÇA", "BRAQA", "BREND", "BREYK", "BREYN", "BRONX", "BUBON", "BUCAQ", "BUDAL", "BUDAQ", "BUDDA", "BUDKA", "BUDUQ", "BUFER", "BUFET", "BUGÜN", "BUKET", "BUKLE", "BULAQ", "BULKA", "BULMA", "BULUD", "BUNCA", "BUNLU", "BUNUD", "BUNUN", "BURAZ", "BURAÇ", "BURMA", "BURNU", "BURSA", "BURUM", "BURUN", "BURUQ", "BURĞU", "BUTAN", "BUTİK", "BUTİL", "BUXAQ", "BUXAR", "BUXOV", "BUXTA", "BUXUN", "BUXUR", "BUYUR", "BUZLU", "BUZOV", "BUZÇU", "BUĞDA", "BUĞUM", "BUĞUR", "BUŞEL", "BÖCƏK", "BÖLGÜ", "BÖLGƏ", "BÖLMƏ", "BÖLÜB", "BÖLÜK", "BÖLÜM", "BÖLÜŞ", "BÖLƏN", "BÖYÜK", "BÖYÜR", "BÜDCƏ", "BÜKMƏ", "BÜKÜB", "BÜKÜK", "BÜKÜM", "BÜKÜŞ", "BÜLUĞ", "BÜLÖV", "BÜRET", "BÜRKÜ", "BÜRÜŞ", "BÜSAT", "BÜTÖV", "BÜTÜN", "BÜZMƏ", "BÜZÜK", "BÜZÜŞ", "BİBƏR", "BİDAD", "BİDON", "BİDİN", "BİDƏT", "BİHAL", "BİHUŞ", "BİKAR", "BİKEF", "BİKOL", "BİKƏS", "BİLDİ", "BİLET", "BİLGİ", "BİLMƏ", "BİLİK", "BİLİM", "BİLİŞ", "BİLƏK", "BİLƏN", "BİLƏR", "BİLƏV", "BİMAR", "BİNAR", "BİNOM", "BİOMÜ", "BİOTA", "BİRCƏ", "BİRDƏ", "BİRGƏ", "BİRJA", "BİRKA", "BİRLİ", "BİRMA", "BİRÜZ", "BİRƏM", "BİRƏR", "BİSAU", "BİTKİ", "BİTLİ", "BİTMƏ", "BİTUM", "BİTİB", "BİTƏN", "BİTƏR", "BİVEC", "BİYAN", "BİYAR", "BİZLİ", "BİZON", "BİZİM", "BİÇMƏ", "BİÇİB", "BİÇİM", "BİÇİN", "BİŞMƏ", "BİŞİR", "BƏBİR", "BƏBƏK", "BƏDÖV", "BƏDİİ", "BƏDƏN", "BƏHAİ", "BƏHRİ", "BƏHRƏ", "BƏHƏR", "BƏKÇİ", "BƏLGƏ", "BƏLKƏ", "BƏLLİ", "BƏLUC", "BƏLİM", "BƏLƏD", "BƏLƏK", "BƏLƏN", "BƏNDƏ", "BƏNNA", "BƏNİZ", "BƏNƏK", "BƏRDƏ", "BƏRKƏ", "BƏRLİ", "BƏRNİ", "BƏRPA", "BƏSTİ", "BƏSTƏ", "BƏSİT", "BƏYAN", "BƏYAZ", "BƏYLİ", "BƏYİM", "BƏZƏK", "BƏZƏN", "BƏŞƏR", "CACIQ", "CADAR", "CAHAN", "CAHIL", "CAHİL", "CALAL", "CALAQ", "CALUD", "CALĞA", "CAMAL", "CAMIŞ", "CAMLI", "CANAN", "CANLA", "CANLI", "CARLI", "CARÇI", "CASUS", "CAVAB", "CAVAD", "CAVAN", "CAVİD", "CECİM", "CEHİZ", "CEMLİ", "CERSİ", "CIDIR", "CILIZ", "CILXA", "CINAQ", "CINDA", "CIQQA", "CIRIQ", "CIRMA", "CIZIB", "CIZIQ", "CIZMA", "CIĞAL", "CIĞIR", "COCUQ", "CORAB", "CORAT", "COŞMA", "COŞQU", "COŞUB", "CUCUQ", "CUHUD", "CUHUL", "CULFA", "CUMMA", "CUVAR", "CÖNGƏ", "CÜBBƏ", "CÜMLƏ", "CÜNUN", "CÜRƏT", "CÜSSƏ", "CÜTÇÜ", "CÜYÜR", "CÜZAM", "CİBLİ", "CİDAL", "CİDAR", "CİDDİ", "CİHAD", "CİHAZ", "CİLLİ", "CİLOV", "CİLVƏ", "CİLƏR", "CİNAH", "CİNAS", "CİNLİ", "CİNSİ", "CİSİM", "CİTSU", "CİVAR", "CİYİL", "CİYƏN", "CİYƏR", "CİZGİ", "CİZYƏ", "CƏBHƏ", "CƏBRİ", "CƏDİD", "CƏFTƏ", "CƏFƏR", "CƏHRƏ", "CƏHƏT", "CƏLAL", "CƏLİL", "CƏLƏK", "CƏNAB", "CƏNUB", "CƏRGƏ", "CƏSUR", "CƏSƏD", "CƏVİZ", "CƏYİR", "DABAN", "DABAQ", "DADAŞ", "DADIM", "DADLI", "DALAN", "DALAQ", "DOLAY", "DALDA", "DALĞA", "DAMAQ", "DAMAR", "DOMBA", "DAMCI", "DAMLA", "DAMĞA", "DARAQ", "DARTI", "DARÇI", "DAVAM", "DAVAR", "DAVUL", "DAXMA", "DAXİL", "DAYAQ", "DAYAZ", "DAĞAL", "DAĞAR", "DAĞLI", "DAĞÇI", "DAİMA", "DAİMİ", "DAİRƏ", "DAŞLI", "DAŞMA", "DAŞÇI", "DEBAT", "DEBET", "DEBÜT", "DEBİL", "DEBİT", "DEFİS", "DEHLİ", "DEKAN", "DEKOR", "DELTA", "DEMƏK", "DERBİ", "DERMA", "DETAL", "DEVON", "DEVİZ", "DEYİB", "DEYİL", "DEYİM", "DEYİŞ", "DEYƏN", "DEİST", "DEİZM", "DEŞMƏ", "DEŞİK", "DIBIR", "DIĞIR", "DODAQ", "DOKER", "DOKÇU", "DOLAB", "DOLAM", "DOLAQ", "DOLAŞ", "DOLMA", "DOLUB", "DOLUQ", "DOLUŞ", "DOLÇA", "DOLĞU", "DOMCA", "DOMEN", "DOMNA", "DOMRA", "DONLU", "DONMA", "DONOR", "DONOS", "DONQA", "DONUQ", "DONUZ", "DOQMA", "DOSYE", "DOVĞA", "DOYMA", "DOYUM", "DOĞAL", "DOĞAN", "DOĞAR", "DOĞMA", "DOĞRU", "DOĞUB", "DOĞUM", "DOĞUŞ", "DOŞAB", "DRAJE", "DREYF", "DROİD", "DRUİD", "DUALI", "DUAÇI", "DUBAY", "DULUS", "DUMAN", "DUNİT", "DURAQ", "DURMA", "DURNA", "DURUB", "DURUM", "DURUŞ", "DURĞU", "DUVAQ", "DUYAR", "DUYMA", "DUYUM", "DUYUQ", "DUYUŞ", "DUYĞU", "DUZAQ", "DUZLU", "DUZÇU", "DÖLMƏ", "DÖLÇÜ", "DÖNGƏ", "DÖNMƏ", "DÖNÜK", "DÖNÜM", "DÖNÜŞ", "DÖNƏM", "DÖNƏR", "DÖVRÜ", "DÖVRİ", "DÖVRƏ", "DÖYCƏ", "DÖYMƏ", "DÖYÜB", "DÖYÜM", "DÖYÜN", "DÖYÜŞ", "DÖYƏC", "DÖZMƏ", "DÖZÜM", "DÖŞLÜ", "DÖŞƏK", "DÜDÜK", "DÜJÜN", "DÜKAN", "DÜKER", "DÜKÇƏ", "DÜMAĞ", "DÜMÜK", "DÜMÜR", "DÜNYA", "DÜNƏN", "DÜRGƏ", "DÜRLÜ", "DÜRMƏ", "DÜYMƏ", "DÜYÜM", "DÜYÜN", "DÜYÜŞ", "DÜZCƏ", "DÜZGÜ", "DÜZMƏ", "DÜZÜB", "DÜZÜM", "DÜZÜŞ", "DÜZƏK", "DÜZƏN", "DÜÇAR", "DÜŞMƏ", "DÜŞÜB", "DÜŞÜK", "DÜŞÜM", "DÜŞÜR", "DÜŞÜŞ", "DÜŞƏN", "DÜŞƏR", "DİBLİ", "DİBƏK", "DİCEY", "DİDMƏ", "DİDİB", "DİDİK", "DİDİM", "DİEDR", "DİFER", "DİGAH", "DİGƏR", "DİKDƏ", "DİKLİ", "DİKMƏ", "DİKTƏ", "DİLDƏ", "DİLER", "DİLLİ", "DİLÇİ", "DİLÇƏ", "DİLİK", "DİLİM", "DİLİN", "DİLƏK", "DİNAR", "DİNLİ", "DİNMƏ", "DİNQO", "DİNÇİ", "DİNİB", "DİNİŞ", "DİRƏK", "DİSKO", "DİVAN", "DİVAR", "DİYAR", "DİYET", "DİYEZ", "DİYİN", "DİZAY", "DİZEL", "DİZİN", "DİŞLİ", "DİŞÇİ", "DİŞƏK", "DƏBBƏ", "DƏBLİ", "DƏCLƏ", "DƏCƏL", "DƏDİR", "DƏFNƏ", "DƏFÇİ", "DƏHNƏ", "DƏHRƏ", "DƏLMƏ", "DƏLİK", "DƏLİL", "DƏMLİ", "DƏMYƏ", "DƏMİR", "DƏMƏK", "DƏNGƏ", "DƏNLİ", "DƏNÇİ", "DƏNİZ", "DƏQİQ", "DƏRGİ", "DƏRMƏ", "DƏRNƏ", "DƏRYA", "DƏRZİ", "DƏRİN", "DƏSTİ", "DƏSTƏ", "DƏVƏT", "DƏYMƏ", "DƏYİB", "DƏYİŞ", "DƏYƏR", "EBENA", "EDİCİ", "EDİKT", "EHKAM", "EHMAL", "EHRAM", "EHSAN", "EKRAN", "ELDƏN", "ELEKT", "ELLİK", "ELLİN", "ELMLİ", "ELSİZ", "ELİTA", "ELƏCƏ", "ELƏMƏ", "ENLİK", "ENMƏK", "ENSİZ", "ENTER", "ENZİM", "ENİNƏ", "EOZİN", "EPONJ", "EPOSU", "EPOXA", "EPİKA", "EPİZM", "ERASI", "ERKER", "ERKƏC", "ERKƏK", "ERKƏN", "ERMƏK", "ERQON", "ESKİZ", "ESTET", "ESTON", "ETMƏK", "ETNOS", "ETNİK", "ETİKA", "ETİNA", "EVCİK", "EVCİL", "EVDAR", "EVENK", "EVLİK", "EVSİZ", "EYHAM", "EYMUR", "EYNƏK", "EYNƏN", "EYVAH", "EYVAN", "EYZƏN", "EŞMƏK", "EŞQLİ", "EŞİLƏ", "EŞŞƏK", "FACİƏ", "FAKTI", "FAKTO", "FALÇI", "FANAT", "FANER", "FAQOT", "FARAD", "FARAŞ", "FASAD", "FASON", "FATAL", "FATEH", "FATMA", "FATUM", "FATİK", "FAUNA", "FAVUS", "FAYDA", "FAĞIR", "FAİZİ", "FENOL", "FERMA", "FETİŞ", "FEİLİ", "FIRIQ", "FIRLI", "FIRÇA", "FLANŞ", "FLORA", "FLÜOR", "FLÜİD", "FLİNT", "FOKAL", "FOKUS", "FOLQA", "FOLİO", "FOMOZ", "FONEM", "FONON", "FOREL", "FORMA", "FORTE", "FORUM", "FOTON", "FRANK", "FRANT", "FRAXT", "FRAZA", "FRENÇ", "FREON", "FREYM", "FROST", "FUQAS", "FURAJ", "FYELD", "FÜRER", "FİBER", "FİBRA", "FİDAN", "FİKRİ", "FİKUS", "FİKİR", "FİLAN", "FİLAR", "FİLMİ", "FİLTR", "FİLİZ", "FİMOZ", "FİNAL", "FİNCƏ", "FİNKA", "FİNİŞ", "FİORD", "FİQUR", "FİRMA", "FİRNİ", "FİRON", "FİRQƏ", "FİTLİ", "FİTNƏ", "FİTOL", "FİTOZ", "FİTRİ", "FİTRƏ", "FİTİL", "FİZİK", "FƏDAİ", "FƏHLƏ", "FƏLƏK", "FƏNNİ", "FƏNƏR", "FƏQİH", "FƏQİR", "FƏQƏT", "FƏRAT", "FƏRDİ", "FƏRLİ", "FƏRƏH", "FƏSAD", "FƏSLİ", "FƏSİL", "FƏTVA", "FƏTİR", "FƏXRİ", "FƏĞAN", "GALIŞ", "GAVUR", "GAVƏR", "GEDİB", "GEDİŞ", "GEDƏN", "GEDƏR", "GENLİ", "GENOM", "GENİŞ", "GETMƏ", "GETTO", "GETİT", "GEYMƏ", "GEYİB", "GEYİM", "GEYŞA", "GOPÇU", "GORDA", "GÖBƏK", "GÖDƏK", "GÖDƏN", "GÖLMƏ", "GÖMMƏ", "GÖMÜR", "GÖNÇÜ", "GÖRGÜ", "GÖRMƏ", "GÖRÜB", "GÖRÜM", "GÖRÜŞ", "GÖRƏK", "GÖRƏN", "GÖTÜR", "GÖVDƏ", "GÖYCƏ", "GÖYLÜ", "GÖYOT", "GÖYÇƏ", "GÖYÜL", "GÖYÜN", "GÖYÜŞ", "GÖYƏM", "GÖZLÜ", "GÖZƏK", "GÖZƏL", "GÜBRƏ", "GÜCLÜ", "GÜCLƏ", "GÜDAZ", "GÜDMƏ", "GÜDÜK", "GÜLAB", "GÜLLÜ", "GÜLLƏ", "GÜLMƏ", "GÜLÇÜ", "GÜLÜB", "GÜLÜL", "GÜLÜŞ", "GÜLƏN", "GÜLƏR", "GÜLƏŞ", "GÜMAN", "GÜMRÜ", "GÜMÜŞ", "GÜNAH", "GÜNAY", "GÜNDƏ", "GÜNEY", "GÜNEL", "GÜNLÜ", "GÜNYƏ", "GÜNƏŞ", "GÜRCÜ", "GÜRZƏ", "GÜVƏC", "GÜVƏN", "GÜYÜM", "GÜZAR", "GÜZGÜ", "GÜZƏM", "GİBBS", "GİCİK", "GİGİT", "GİLAH", "GİLAN", "GİLAS", "GİLCƏ", "GİLEY", "GİLLİ", "GİLİZ", "GİLƏK", "GİPÜR", "GİRDƏ", "GİRGİ", "GİRLİ", "GİRMƏ", "GİROV", "GİRVƏ", "GİRİB", "GİRİŞ", "GİRƏR", "GİYİD", "GİYƏV", "GİZLİ", "GİZİR", "GƏDİK", "GƏLDİ", "GƏLMƏ", "GƏLİM", "GƏLİN", "GƏLİR", "GƏLİŞ", "GƏLƏN", "GƏLƏR", "GƏMİK", "GƏNCƏ", "GƏNZƏ", "GƏNƏŞ", "GƏRDƏ", "GƏRMƏ", "GƏRÇİ", "GƏRƏK", "GƏTİR", "GƏVƏN", "GƏZMƏ", "GƏZİB", "GƏZİŞ", "GƏZƏL", "GƏZƏN", "HAAQA", "HAFİZ", "HAKER", "HAKİM", "HALAL", "HALAY", "HALDA", "HALLI", "HALQA", "HALVA", "HALƏT", "HAMAM", "HAMAR", "HAMAŞ", "HAMPA", "HANSI", "HAQLI", "HARAM", "HARAY", "HARIN", "HAROV", "HASAR", "HASİL", "HATƏM", "HAVAR", "HAVAY", "HAVUS", "HAYAN", "HAYDI", "HAYIL", "HAYLI", "HAYÇI", "HAZIR", "HAÇAN", "HAİTİ", "HEGEL", "HERİK", "HESAB", "HEYBƏ", "HEYNE", "HEYVA", "HEYİF", "HEYƏT", "HEŞAN", "HOBBİ", "HODAQ", "HOKKU", "HOPMA", "HOPPA", "HOQQA", "HORRA", "HORST", "HOTEL", "HOVLU", "HOVUR", "HOVUZ", "HOYDU", "HOÇAZ", "HUMUS", "HUMİN", "HUMİT", "HUŞLU", "HÖCƏT", "HÖRGÜ", "HÖRMƏ", "HÖRÜK", "HÖVKƏ", "HÖVZƏ", "HÖYÜŞ", "HÜCRƏ", "HÜCUM", "HÜDUD", "HÜNƏR", "HÜQUQ", "HÜRMƏ", "HÜRÜŞ", "HÜZUR", "HİCAB", "HİCRİ", "HİDRA", "HİKKƏ", "HİLAL", "HİLLİ", "HİMNİ", "HİNDU", "HİSLİ", "HİSSİ", "HİSSƏ", "HİYLƏ", "HƏBƏŞ", "HƏCMİ", "HƏDDİ", "HƏDİK", "HƏDİS", "HƏDƏF", "HƏDƏR", "HƏFTƏ", "HƏKİM", "HƏLAK", "HƏLLİ", "HƏLİM", "HƏLƏM", "HƏMLİ", "HƏMLƏ", "HƏMİN", "HƏNİR", "HƏQİR", "HƏRBİ", "HƏRBƏ", "HƏRFİ", "HƏRKİ", "HƏRZƏ", "HƏRİF", "HƏRİS", "HƏRƏM", "HƏSİR", "HƏSƏD", "HƏSƏN", "HƏTTA", "HƏVƏS", "HƏYAT", "HƏYƏT", "HƏZRƏ", "HƏZİN", "HƏZƏC", "HƏZƏR", "HƏŞİR", "HƏŞİŞ", "HƏŞƏM", "IMTIL", "JAKET", "JALON", "JALÜZ", "JETON", "JEVEL", "JOKEY", "JİLET", "JİRON", "KABAB", "KABEL", "KABUS", "KADET", "KAFEL", "KAFUR", "KAFİR", "KAHAL", "KAHİN", "KAKAO", "KALAM", "KALAN", "KALIM", "KALIŞ", "KALKA", "KALLA", "KALOT", "KALTA", "KALVA", "KALYO", "KAMAL", "KAMAN", "KAMBA", "KAMBO", "KAMBİ", "KAMER", "KAMOR", "KAMİL", "KAMİN", "KANAL", "KANAT", "KANNA", "KANOE", "KANON", "KANTE", "KANTO", "KANVA", "KAPER", "KAPOK", "KAPOT", "KAPSA", "KAPUT", "KARAT", "KAREL", "KAREN", "KARET", "KARLI", "KARLO", "KARMA", "KARQO", "KARST", "KARİB", "KARİO", "KASAD", "KASET", "KASIB", "KASKA", "KASKO", "KASNİ", "KASPİ", "KASSA", "KASSO", "KASTA", "KATAR", "KATER", "KATET", "KATEX", "KATOD", "KATTA", "KATİB", "KAURİ", "KAYRA", "KAYUT", "KAZAK", "KAZAN", "KAZUS", "KAÇİN", "KAĞAN", "KAĞIZ", "KAŞNE", "KECİM", "KEDDİ", "KEDRA", "KEFAL", "KEFLİ", "KEFİR", "KEGEL", "KENDO", "KEPKA", "KESON", "KETON", "KEÇMƏ", "KEÇİB", "KEÇİD", "KEÇİR", "KEÇƏL", "KEÇƏN", "KEÇƏR", "KEŞLƏ", "KEŞİK", "KEŞİŞ", "KHMER", "KLARK", "KLATÇ", "KLERK", "KLEYN", "KLOUN", "KLİŞE", "KNYAZ", "KOBAN", "KOBOL", "KOBRA", "KOBUD", "KOBZA", "KODAL", "KODER", "KODLU", "KOFTA", "KOKOS", "KOLBA", "KOLLU", "KOLİT", "KOMBA", "KOMBİ", "KOMOD", "KOMOR", "KOMİK", "KONKA", "KONKİ", "KONQO", "KONTO", "KONTR", "KONUS", "KONYA", "KONİK", "KOPAL", "KORDA", "KORMA", "KORUN", "KORUŞ", "KOSLU", "KOTAN", "KOVXA", "KOYNE", "KOĞUŞ", "KRAYT", "KREDO", "KREML", "KREOL", "KREVO", "KROKİ", "KRUİZ", "KRYAJ", "KSERO", "KSİLO", "KUBOK", "KUKLA", "KULER", "KULON", "KULUF", "KULİS", "KUMAN", "KUMJA", "KUMOL", "KUMİR", "KUPAJ", "KUPON", "KUPÜR", "KURAY", "KURSK", "KURTİ", "KURUS", "KURUŞ", "KUSUB", "KUTOR", "KUTİN", "KUZOV", "KUZUN", "KUĞUZ", "KUŞAN", "KUŞİT", "KVANT", "KVARK", "KVARS", "KVAZİ", "KVAÇA", "KVEST", "KVOTA", "KÖBƏR", "KÖHNƏ", "KÖHÜL", "KÖKLÜ", "KÖKƏN", "KÖLGƏ", "KÖMBƏ", "KÖMÜR", "KÖMƏC", "KÖMƏK", "KÖNÜL", "KÖPMƏ", "KÖPÜB", "KÖPÜK", "KÖPƏK", "KÖPƏŞ", "KÖRPÜ", "KÖRPƏ", "KÖRÜK", "KÖSÖV", "KÖTÜK", "KÖTÜR", "KÖTƏK", "KÖVƏR", "KÖYLÜ", "KÖZƏL", "KÖÇLÜ", "KÖÇMƏ", "KÖŞƏK", "KÜBAR", "KÜDRÜ", "KÜFLƏ", "KÜFTƏ", "KÜHÜL", "KÜKƏL", "KÜLFƏ", "KÜLLÜ", "KÜLLİ", "KÜLMƏ", "KÜLTƏ", "KÜLÇƏ", "KÜLÜF", "KÜLÜS", "KÜLƏK", "KÜLƏŞ", "KÜMÇÜ", "KÜNDƏ", "KÜNYƏ", "KÜPLÜ", "KÜPÇÜ", "KÜPÇƏ", "KÜRDÜ", "KÜRET", "KÜRLÜ", "KÜRRƏ", "KÜRSÜ", "KÜRÜK", "KÜRÜŞ", "KÜRƏK", "KÜRƏN", "KÜSKÜ", "KÜSMƏ", "KÜSÜB", "KÜSÜK", "KÜSƏK", "KÜTLÜ", "KÜTLƏ", "KÜTUC", "KÜTÜM", "KÜVET", "KÜVƏR", "KÜVƏZ", "KÜYLÜ", "KÜYÇÜ", "KÜYÜL", "KÜZLÜ", "KÜÇÜK", "KİANQ", "KİBER", "KİDAN", "KİFLİ", "KİFOZ", "KİFİR", "KİJUÇ", "KİLKƏ", "KİLSƏ", "KİLİD", "KİLİM", "KİMAK", "KİMSƏ", "KİMYA", "KİNEM", "KİNLİ", "KİNOA", "KİOSK", "KİPCƏ", "KİRLİ", "KİRNƏ", "KİRPİ", "KİRVƏ", "KİRXA", "KİRZA", "KİRİL", "KİRİŞ", "KİRŞƏ", "KİRƏC", "KİRƏN", "KİSEL", "KİSTA", "KİTAB", "KİTEL", "KİTRƏ", "KİVER", "KİXON", "KİYEV", "KİÇİK", "KƏBİN", "KƏDƏR", "KƏFƏN", "KƏHRƏ", "KƏHƏR", "KƏKOV", "KƏKRƏ", "KƏKİL", "KƏLAM", "KƏLLƏ", "KƏLMƏ", "KƏLTƏ", "KƏLÇƏ", "KƏLİK", "KƏLƏF", "KƏLƏK", "KƏLƏM", "KƏLƏZ", "KƏMƏR", "KƏNAF", "KƏNAR", "KƏNİZ", "KƏPƏK", "KƏPƏZ", "KƏRDİ", "KƏRKİ", "KƏRKƏ", "KƏRMƏ", "KƏRİM", "KƏRƏM", "KƏRƏN", "KƏSKİ", "KƏSMƏ", "KƏSRİ", "KƏSİB", "KƏSİK", "KƏSİM", "KƏSİN", "KƏSİR", "KƏSƏK", "KƏSƏN", "KƏSƏR", "KƏTAN", "KƏTİL", "KƏVƏR", "LABÜD", "LABİL", "LADAN", "LAFET", "LAHIC", "LAKCA", "LAKEY", "LAKLI", "LAKÇI", "LAKİN", "LALIQ", "LAMAQ", "LAMER", "LAMPA", "LAMUS", "LAMUT", "LANDO", "LANKA", "LAPAN", "LAPAR", "LARQO", "LASSO", "LATIN", "LATIŞ", "LATUN", "LATİT", "LAVAŞ", "LAVRA", "LAXTA", "LAYAN", "LAYBA", "LAYKA", "LAYLA", "LAYLI", "LAYİQ", "LAZCA", "LAZER", "LAZIM", "LAÇIN", "LAĞAR", "LAĞIM", "LAĞÇI", "LAŞMA", "LEHMƏ", "LEHİM", "LEKAL", "LEMMA", "LEMUR", "LEPRA", "LEPTA", "LEQAL", "LERİK", "LEVİT", "LEYST", "LIĞLI", "LOBBİ", "LOBYA", "LOGİN", "LOKAL", "LOKAY", "LOMBA", "LOPAR", "LOPUQ", "LOTOS", "LOVLU", "LOVĞA", "LOYAL", "LOĞAZ", "LOĞMA", "LUDÇU", "LUKAN", "LUNİT", "LUPİN", "LÖKÜT", "LÖSİT", "LÖVHƏ", "LÜKLÜ", "LÜLƏK", "LÜMEN", "LÜMƏK", "LÜNET", "LÜPUS", "LÜTCƏ", "LÜZUM", "LÜĞƏT", "LİANA", "LİBAS", "LİBOR", "LİCİM", "LİDER", "LİFLİ", "LİFÇİ", "LİKÖR", "LİLLİ", "LİMAN", "LİMFA", "LİMON", "LİMİT", "LİNZA", "LİPİD", "LİRİD", "LİRİK", "LİSEY", "LİTER", "LİTVA", "LİVAN", "LİYEV", "LİZOL", "LİZİN", "LİZİS", "LƏCƏT", "LƏGƏR", "LƏHCƏ", "LƏKLİ", "LƏKİN", "LƏKİT", "LƏLƏK", "LƏLƏŞ", "LƏMAN", "LƏNƏT", "LƏPİK", "LƏPİR", "LƏQƏB", "LƏRGƏ", "LƏRZƏ", "LƏRİN", "LƏTLİ", "LƏTİF", "LƏYƏN", "LƏZGİ", "LƏZİZ", "LƏÇƏK", "LƏÇƏR", "LƏŞMƏ", "MACAL", "MACAR", "MADAM", "MADAR", "MADDİ", "MADDƏ", "MADUR", "MAFAR", "MAHAL", "MAHNI", "MAHUD", "MAHİR", "MAJOR", "MAKAO", "MAKET", "MAKRO", "MALAX", "MALAY", "MALLI", "MALTA", "MALUS", "MALİK", "MAMBA", "MAMIR", "MANAT", "MANDE", "MANEJ", "MANEƏ", "MANKO", "MANQA", "MANQO", "MANSİ", "MANTO", "MANUL", "MAORİ", "MAOÇU", "MAQAS", "MAQMA", "MAQOV", "MARAL", "MARAN", "MARAQ", "MARIQ", "MARIT", "MARJA", "MARKA", "MARTI", "MASAJ", "MASAİ", "MASKA", "MASON", "MATAH", "MATAN", "MATRA", "MATƏM", "MAVRI", "MAXTA", "MAYAK", "MAYIL", "MAYKA", "MAYOR", "MAYYA", "MAZAQ", "MAZAT", "MAZIX", "MAZLI", "MAZUR", "MAZUT", "MAĞAR", "MAİLİ", "MAŞIN", "MEBEL", "MEDAL", "MEDYE", "MEDİA", "MEHDİ", "MEHLİ", "MELOS", "MEMAR", "MENYU", "MERAC", "MERYA", "MESAJ", "MESSA", "MESSO", "METAL", "METAN", "METOD", "METOL", "METON", "METRO", "METSO", "METİL", "METİS", "MEYAR", "MEYLİ", "MEYNƏ", "MEYOZ", "MEYVƏ", "MEYİL", "MEYİT", "MEZON", "MEŞİN", "MEŞƏÇ", "MIRDA", "MIRIQ", "MIRTI", "MIXLI", "MIXÇA", "MIŞIL", "MNEMO", "MOBİL", "MODAL", "MODEL", "MODEM", "MODLU", "MODUL", "MODUS", "MOFET", "MOHER", "MOKKO", "MOKŞA", "MOLLA", "MOLLU", "MONAX", "MONEL", "MONEM", "MONET", "MONQO", "MONTE", "MOPED", "MOPLA", "MOQAR", "MOQUS", "MORAL", "MOREN", "MORFİ", "MORUQ", "MORZE", "MOSUL", "MOTAL", "MOTEL", "MOTET", "MOTOR", "MOTTO", "MOTUQ", "MOTİV", "MOYVA", "MOĞAL", "MOĞOL", "MOĞUL", "MOİZM", "MOİZƏ", "MTRAQ", "MUAVR", "MUCUL", "MUCUQ", "MUFEL", "MUFTA", "MUKOR", "MULAT", "MULDA", "MULTİ", "MULÇA", "MUMLU", "MUNTS", "MUNİS", "MURAD", "MUROV", "MUTON", "MUXAS", "MUZEY", "MUZİK", "MUĞAM", "MUĞAN", "MUŞAQ", "MÖHNƏ", "MÖHRƏ", "MÖHÜR", "MÖMİN", "MÖVQE", "MÖVZU", "MÖVÜC", "MÜALİ", "MÜCRÜ", "MÜDAM", "MÜDRİ", "MÜDİR", "MÜFTİ", "MÜFTƏ", "MÜHÜM", "MÜHİT", "MÜJDƏ", "MÜLKİ", "MÜRGÜ", "MÜRİD", "MÜSYÖ", "MİAZM", "MİFİK", "MİKOZ", "MİKRO", "MİLAD", "MİLAN", "MİLAX", "MİLEM", "MİLLİ", "MİLÇƏ", "MİLİS", "MİMİK", "MİNER", "MİNMƏ", "MİNOR", "MİNOY", "MİNUS", "MİNİB", "MİNİK", "MİNİŞ", "MİOMA", "MİQMA", "MİRAJ", "MİRAS", "MİRZƏ", "MİRİK", "MİSAL", "MİSLİ", "MİSRA", "MİSRİ", "MİSİL", "MİSİR", "MİTOZ", "MİTRA", "MİTİL", "MİXƏK", "MİZAN", "MİZLİ", "MİZİD", "MİŞAR", "MİŞNİ", "MƏBƏD", "MƏCAZ", "MƏCMU", "MƏCRA", "MƏCUN", "MƏDƏN", "MƏGƏR", "MƏHƏK", "MƏHƏL", "MƏKAN", "MƏKKƏ", "MƏLAL", "MƏLUL", "MƏLUM", "MƏLUN", "MƏLİK", "MƏLƏK", "MƏLƏR", "MƏLƏS", "MƏLƏZ", "MƏMUR", "MƏNBƏ", "MƏNCƏ", "MƏNFİ", "MƏNLİ", "MƏNŞƏ", "MƏNƏM", "MƏNƏN", "MƏQAM", "MƏQSƏ", "MƏQTƏ", "MƏRAM", "MƏRCİ", "MƏRMİ", "MƏRUZ", "MƏRZƏ", "MƏRİZ", "MƏRƏK", "MƏRƏZ", "MƏSUD", "MƏSUL", "MƏSUM", "MƏSƏL", "MƏTBU", "MƏTLİ", "MƏTLƏ", "MƏTİN", "MƏXFİ", "MƏXƏZ", "MƏYUS", "MƏZAC", "MƏZAR", "MƏZRƏ", "MƏZUN", "MƏŞUM", "MƏŞUQ", "MƏŞƏL", "NABAT", "NABUR", "NADAN", "NADİL", "NADİR", "NAGAH", "NAHAQ", "NAHAR", "NAKAM", "NAKƏS", "NALAN", "NALLI", "NALÇA", "NAMAZ", "NAMUS", "NANAY", "NANDU", "NANDİ", "NANKA", "NAPAK", "NAQAN", "NAQQA", "NAQUS", "NAQİL", "NAQİS", "NARIN", "NARLI", "NARÇI", "NASAZ", "NASOS", "NASİR", "NATİQ", "NAXIR", "NAXIŞ", "NAXOŞ", "NAXUA", "NAXÇI", "NAZLI", "NAZİK", "NAZİR", "NAÇAR", "NAĞIL", "NAŞİR", "NEFAR", "NEHRƏ", "NELMA", "NEMƏT", "NEPAL", "NETTO", "NOHUR", "NOQAY", "NORKA", "NORMA", "NORİT", "NOTLU", "NOVLU", "NOVUR", "NOVÇA", "NOXTA", "NOXUD", "NOĞUL", "NUNSİ", "NURAN", "NURLU", "NURSU", "NÖKƏR", "NÖMRƏ", "NÖQTƏ", "NÖVBƏ", "NÖVCÜ", "NÖVHƏ", "NÖVLÜ", "NÜANS", "NÜBAR", "NÜFUZ", "NÜSXƏ", "NİCAT", "NİFAQ", "NİGAH", "NİGAR", "NİJNİ", "NİKAH", "NİKEL", "NİMFA", "NİMÇƏ", "NİNNİ", "NİQAB", "NİSBİ", "NİSBƏ", "NİSYƏ", "NİVAL", "NİYAZ", "NİZAM", "NİŞAN", "NƏCİB", "NƏCİS", "NƏCƏF", "NƏDİM", "NƏDƏN", "NƏFLİ", "NƏFİS", "NƏFƏR", "NƏFƏS", "NƏMLİ", "NƏMİŞ", "NƏMƏR", "NƏNNİ", "NƏQLİ", "NƏSNƏ", "NƏSİB", "NƏSİL", "NƏSƏB", "NƏZİR", "NƏZƏR", "NƏĞMƏ", "NƏŞRİ", "NƏŞƏT", "OAYKI", "OAZİS", "OBALI", "OBAÇI", "OBRAZ", "OCAĞI", "ODALI", "ODDAĞ", "ODLAQ", "ODLUQ", "ODSUZ", "OFORT", "OFSET", "OFŞOR", "OHAYO", "OSAKA", "OKEAN", "OKSER", "OKSİD", "OKTAN", "OKTET", "OKTOD", "OLEİN", "OLMAQ", "OLMAZ", "OLMUŞ", "OLSUN", "OLİQO", "OMEQA", "OMLET", "ONBEŞ", "ONDAN", "ONEYS", "ONLAR", "ONLUQ", "ONSUZ", "ONİKS", "OOLİT", "OPERA", "OPTİK", "OPİUM", "OQAMİ", "ORADA", "ORALI", "ORAND", "ORAON", "ORAYA", "ORBİT", "ORDEN", "ORDER", "ORFOQ", "ORLON", "ORMAN", "ORQAN", "ORTAM", "ORTAQ", "ORTİT", "ORUZU", "ORXON", "ORYOL", "ORİYA", "OSKCA", "OSMAN", "OSMOS", "OTAĞA", "OTLAQ", "OTLUQ", "OTSUZ", "OVDAN", "OVDUQ", "OVLAQ", "OVMAQ", "OVQAT", "OVSAR", "OVSUN", "OVUCU", "OVURD", "OVXAQ", "OVXAR", "OXDAN", "OXLOV", "OXLUQ", "OXOTU", "OXSUZ", "OXUCU", "OXULU", "OXUMA", "OXŞAR", "OYLAQ", "OYMAQ", "OYNAQ", "OYNAR", "OYNAŞ", "OYRAT", "OYUNU", "OÇERK", "OĞLAN", "OĞLAQ", "OĞRUN", "PADAR", "PAFOS", "PAFTA", "PAKER", "PAKET", "PALAN", "PALAZ", "PALEO", "PALET", "PALEX", "PALID", "PALLI", "PALMA", "PALTO", "PAMİR", "PANDA", "PANEL", "PANNO", "PANÇA", "PAPAQ", "PAPIŞ", "PAPYE", "PARAD", "PARAF", "PARAQ", "PAREZ", "PAROL", "PARÇA", "PARİK", "PARİS", "PASAJ", "PASAQ", "PASLI", "PASTA", "PASXA", "PATAN", "PAUZA", "PAXAR", "PAXIL", "PAXIR", "PAXLA", "PAYIZ", "PAYÇI", "PAZAO", "PAZLI", "PEDAL", "PEKAN", "PEKİN", "PEMZA", "PENAL", "PENNİ", "PENYA", "PENZA", "PENİS", "PEPSİ", "PETİT", "PEYDA", "PEYİN", "PILTI", "PIRIL", "PIXTA", "PLAST", "PLATA", "PLATO", "PLATS", "PLAUN", "PLAZA", "PLEBS", "PLOMB", "PLYAJ", "PLYUS", "PLİTƏ", "POEMA", "POKER", "POLAD", "POLKA", "POLİP", "POLİQ", "POLİS", "POLŞA", "POMOR", "POMPA", "PONÇO", "POQON", "PORNO", "PORTO", "PORUQ", "POTAŞ", "POYLU", "POZAN", "POZMA", "POZUQ", "PRANA", "PRANK", "PRAYD", "PRAYM", "PRAYS", "PRERİ", "PRESS", "PROTO", "PROZA", "PRUSS", "PRİMA", "PRİNS", "PRİNT", "PSKOV", "PSİXO", "PSİXİ", "PUANT", "PUDEL", "PUDRA", "PULLU", "PULPA", "PUNKT", "PURİN", "PUSMA", "PUSQU", "PUÇAL", "PUÇUR", "PUŞTU", "PÖHRƏ", "PÖRTÜ", "PÜLÜK", "PÜSTƏ", "PÜXTƏ", "PİANO", "PİFOS", "PİKAP", "PİKET", "PİLLƏ", "PİLON", "PİLOT", "PİLTƏ", "PİLİK", "PİLƏK", "PİNEN", "PİNOL", "PİNTİ", "PİPET", "PİPİK", "PİRAL", "PİRAN", "PİRAT", "PİRKE", "PİROP", "PİROQ", "PİRİT", "PİSLİ", "PİTON", "PİYLİ", "PİZZA", "PİŞİK", "PİŞİM", "PƏLMƏ", "PƏLİN", "PƏNAH", "PƏNBƏ", "PƏNCƏ", "PƏRDİ", "PƏRDƏ", "PƏRLİ", "PƏRQU", "PƏRƏK", "PƏRƏN", "PƏTƏK", "QABAN", "QABAQ", "QABAR", "QABIQ", "QABLI", "QABON", "QABOY", "QABRO", "QABİL", "QACAQ", "QACAR", "QACLI", "QADAQ", "QADIN", "QADİR", "QAFEL", "QAFİL", "QAHAB", "QALAC", "QALAN", "QALAQ", "QALAY", "QALDI", "QALET", "QALIM", "QALIN", "QALIQ", "QALIR", "QALMA", "QALOŞ", "QALÇA", "QALİB", "QAMAK", "QAMET", "QAMIŞ", "QAMMA", "QAMÇI", "QAMƏT", "QANAD", "QANAŞ", "QANIQ", "QANLI", "QANMA", "QANOV", "QANUN", "QANİT", "QAPAN", "QAPAQ", "QAPAZ", "QAPIŞ", "QAPMA", "QAQAR", "QAQAT", "QAQUM", "QARAJ", "QARDA", "QARIM", "QARIN", "QARIŞ", "QARLI", "QARMA", "QAROV", "QARPA", "QARTA", "QARUS", "QARĞA", "QARĞI", "QARŞI", "QARƏT", "QASIQ", "QASİD", "QATAR", "QATIB", "QATIM", "QATIQ", "QATIR", "QATLI", "QATMA", "QATQI", "QATİL", "QAVAL", "QAVOT", "QAXAC", "QAXMA", "QAYDA", "QAYIB", "QAYIM", "QAYIN", "QAYIQ", "QAYIŞ", "QAYKA", "QAYMA", "QAYOT", "QAYSA", "QAYSI", "QAYÇI", "QAYĞI", "QAZAN", "QAZAX", "QAZIQ", "QAZLI", "QAZMA", "QAZON", "QAÇAQ", "QAÇAR", "QAÇDI", "QAÇIŞ", "QAÇMA", "QAİMƏ", "QAŞIQ", "QAŞLI", "QAŞOV", "QAŞQA", "QEYRİ", "QICIQ", "QIDIQ", "QIFIL", "QIJOV", "QILAF", "QILIQ", "QILLI", "QILMA", "QILOV", "QILÇA", "QIMIZ", "QINAQ", "QINDI", "QINLI", "QIPIQ", "QIPMA", "QIRAQ", "QIRAT", "QIRDI", "QIRIB", "QIRIM", "QIRIQ", "QIRIŞ", "QIRLI", "QIRMA", "QIRNA", "QIROV", "QIRTA", "QIRTI", "QIRÇI", "QIRĞI", "QISIQ", "QISIR", "QISMA", "QISQI", "QIYIQ", "QIYMA", "QIYYA", "QIZIL", "QIZLI", "QIZMA", "QIŞIN", "QIŞLA", "QIŞLI", "QLİPT", "QNEYS", "QOBOY", "QOBUR", "QODUQ", "QOHUM", "QOLAC", "QOLAY", "QOLFİ", "QOLLU", "QONAQ", "QONMA", "QONUM", "QONUR", "QONZO", "QONİT", "QONŞU", "QOPMA", "QOPUQ", "QOPUZ", "QORKİ", "QORLU", "QORUQ", "QORXA", "QORXU", "QORÇU", "QOTAZ", "QOTUR", "QOTİK", "QOVAN", "QOVAQ", "QOVDU", "QOVMA", "QOVUN", "QOVUQ", "QOVUT", "QOVUŞ", "QOVĞA", "QOYMA", "QOYUN", "QOYUR", "QOZLU", "QOÇAQ", "QOĞAL", "QOŞAQ", "QOŞMA", "QOŞQU", "QOŞUB", "QOŞUN", "QOŞUQ", "QRAFA", "QRAND", "QRANT", "QRUNT", "QRUSİ", "QUBAR", "QUCAQ", "QUCMA", "QUCUM", "QUDOK", "QUDUZ", "QULAM", "QULAN", "QULAQ", "QULUN", "QUMAR", "QUMAŞ", "QUMLU", "QUMMA", "QUMRU", "QUMUQ", "QUPTA", "QUPUŞ", "QUQQU", "QURAN", "QURAQ", "QURMA", "QURNA", "QURUB", "QURUM", "QURUQ", "QURUT", "QURUŞ", "QURĞU", "QUSAR", "QUSLİ", "QUSMA", "QUTAB", "QUTAN", "QUTTA", "QUZEY", "QUŞQU", "QUŞÇU", "QÖNÇƏ", "QÖVSÜ", "QÖVSİ", "QÜBBƏ", "QÜLLƏ", "QÜRRƏ", "QÜRUB", "QÜRUR", "QÜSSƏ", "QÜSUR", "QÜVVƏ", "QÜZEH", "QİBLƏ", "QİBTƏ", "QİSAS", "QİSSƏ", "QİSİM", "QİYAM", "QİYAQ", "QİYMƏ", "QİYYƏ", "QƏBUL", "QƏBZƏ", "QƏBİL", "QƏBİR", "QƏBİZ", "QƏCƏC", "QƏDLİ", "QƏDİD", "QƏDİM", "QƏDİR", "QƏDƏH", "QƏDƏK", "QƏDƏM", "QƏDƏR", "QƏFİL", "QƏFƏS", "QƏHVƏ", "QƏHƏR", "QƏHƏT", "QƏLBİ", "QƏLBƏ", "QƏLPƏ", "QƏLİB", "QƏLİZ", "QƏLƏM", "QƏLƏT", "QƏMLİ", "QƏMZƏ", "QƏMƏR", "QƏNİM", "QƏNİR", "QƏPİK", "QƏRAR", "QƏRBİ", "QƏRİB", "QƏRƏZ", "QƏSİL", "QƏSƏM", "QƏTFƏ", "QƏTRƏ", "QƏTƏR", "QƏZET", "QƏZİL", "QƏZƏB", "QƏZƏL", "QƏŞƏD", "RABAT", "RADAR", "RADON", "RADİO", "RAHAT", "RAHİB", "RAKEL", "RAKET", "RALLİ", "RANET", "RANÇO", "RAPİD", "RASTA", "RASTR", "RATUŞ", "RATİN", "RATİT", "RAUND", "RAXİT", "RAYON", "RAYTS", "REALİ", "REBUS", "REDUT", "REFLE", "REJİM", "REKET", "REKON", "REKTA", "RELİN", "RELİZ", "REMİZ", "RENAT", "RENTA", "REPER", "REPÇİ", "REQBİ", "RETRO", "RETTA", "RETUŞ", "REYKA", "REZUS", "REZİN", "RIÇAQ", "ROBOT", "ROLLU", "ROLLİ", "ROLÇU", "ROLİK", "ROMAN", "ROMNİ", "RONDO", "RONQA", "ROSTR", "ROTEL", "ROTOR", "ROYAL", "RUFER", "RUHLU", "RUHƏN", "RULET", "RULON", "RUMBA", "RUMIN", "RUMLU", "RUNDİ", "RUNİK", "RUPOR", "RUSCA", "RUTER", "RUTUL", "RUTİL", "RUŞAN", "RÜBAB", "RÜBAİ", "RÜSUM", "RÜTBƏ", "RİCƏT", "RİFAH", "RİGEL", "RİKŞA", "RİMAN", "RİNCİ", "RİNİN", "RİNİT", "RİPAL", "RİTON", "RİTOR", "RİYAZ", "RİÇAL", "RİŞTA", "RƏCƏB", "RƏCƏZ", "RƏDİF", "RƏFLİ", "RƏFİQ", "RƏHİL", "RƏKƏT", "RƏMZİ", "RƏMƏL", "RƏNDƏ", "RƏNGƏ", "RƏQİB", "RƏQƏM", "RƏSMİ", "RƏSUL", "RƏVAC", "RƏVAN", "RƏYÇİ", "RƏZİL", "RƏŞMƏ", "SABAH", "SABUN", "SABİQ", "SABİR", "SABİT", "SACLI", "SADAQ", "SADİQ", "SAHİB", "SAHİL", "SAKİN", "SAKİT", "SALAM", "SALAR", "SALAT", "SALDO", "SALEH", "SALIM", "SALON", "SALTO", "SALUR", "SALÇI", "SAMAN", "SAMBA", "SAMBO", "SAMUR", "SAMUX", "SAMİT", "SANAR", "SANCA", "SANCI", "SANDA", "SANIB", "SANKT", "SANKİ", "SANLI", "SANMA", "SAPAN", "SAPFA", "SAPLI", "SAPMA", "SAQQO", "SARAY", "SARIQ", "SARJA", "SARLA", "SARMA", "SAROV", "SARĞI", "SASAK", "SATIB", "SATIM", "SATIN", "SATIŞ", "SATMA", "SATQI", "SATİN", "SAUNA", "SAVAB", "SAVAD", "SAVAR", "SAVAT", "SAVAŞ", "SAXSI", "SAXTA", "SAXUR", "SAYAQ", "SAYCA", "SAYDA", "SAYIB", "SAYIQ", "SAYIR", "SAYKA", "SAYMA", "SAYRA", "SAYRU", "SAYÇI", "SAYĞI", "SAZAN", "SAZAQ", "SAZLI", "SAZÇI", "SAZİŞ", "SAÇAQ", "SAÇIQ", "SAÇLI", "SAÇMA", "SAĞAN", "SAĞIM", "SAĞIN", "SAĞIR", "SAĞMA", "SAĞRI", "SAĞÇI", "SAİRƏ", "SAİTİ", "SEANS", "SEDAN", "SEGAH", "SEKTA", "SELEN", "SELFİ", "SELSİ", "SELVA", "SELİK", "SENAJ", "SENAT", "SENON", "SENOZ", "SENOİ", "SEROZ", "SERUM", "SERİN", "SETAR", "SEVDA", "SEVGİ", "SEVMƏ", "SEVİB", "SEVƏR", "SEXLİ", "SEXÇİ", "SEYİD", "SEZAR", "SEZMƏ", "SEÇKİ", "SEÇMƏ", "SEÇİM", "SFERA", "SICAQ", "SIFIR", "SINAQ", "SINIB", "SINIQ", "SINMA", "SIRIQ", "SIRMA", "SIRĞA", "SISQA", "SITMA", "SIXAC", "SIXIM", "SIXMA", "SIYIQ", "SIZAQ", "SIZIB", "SIZIM", "SIZIQ", "SIZMA", "SIZQA", "SIĞAL", "SIĞIM", "SIĞIN", "SIĞIR", "SIĞMA", "SKALD", "SKALP", "SKARK", "SKAUT", "SKAYP", "SKETÇ", "SKEYT", "SKRAB", "SKRİN", "SKUNS", "SKVOŞ", "SLAYD", "SLAYM", "SMART", "SMERD", "SMETA", "SOLAN", "SOLAQ", "SOLLU", "SOLMA", "SOLOO", "SOLUB", "SOLUQ", "SOLÇU", "SONET", "SONLU", "SONOR", "SONRA", "SONUC", "SOPLO", "SORAQ", "SORMA", "SORQO", "SORĞU", "SOSİS", "SOVET", "SOVKA", "SOVLU", "SOVMA", "SOVUB", "SOVXA", "SOVÇA", "SOXMA", "SOYAD", "SOYLU", "SOYMA", "SOYUQ", "SOYĞU", "SOĞAN", "SOĞDİ", "SPAYK", "SPRED", "SPREY", "SPİRT", "SSUDA", "STALK", "START", "STELA", "STEND", "STENT", "STOİK", "STRES", "STREÇ", "SUBAY", "SUCAQ", "SUCUQ", "SUDAN", "SUDUR", "SUFLE", "SUKRE", "SULAQ", "SULAR", "SULUF", "SULUQ", "SULUT", "SUMAQ", "SUOXU", "SUPER", "SUQAC", "SURRA", "SURƏT", "SUSAY", "SUSMA", "SUSUZ", "SUTKA", "SUVAQ", "SUVAT", "SUYAO", "SUYUM", "SUÇLU", "SUÇMA", "SUÇUQ", "SUİTİ", "SVİTÇ", "SÖKMƏ", "SÖKÜB", "SÖKÜK", "SÖKƏK", "SÖNMƏ", "SÖNÜK", "SÖVDƏ", "SÖYMƏ", "SÖYÜD", "SÖYÜŞ", "SÖZLÜ", "SÖZLƏ", "SÖZÇÜ", "SÖZÜN", "SÜBUT", "SÜDLÜ", "SÜDÇO", "SÜDÇÜ", "SÜFRƏ", "SÜJET", "SÜKAN", "SÜKUT", "SÜLHÜ", "SÜLÜK", "SÜLƏK", "SÜMSÜ", "SÜMÜK", "SÜNBƏ", "SÜNDÜ", "SÜNGÜ", "SÜNNİ", "SÜPÜR", "SÜQUT", "SÜRBƏ", "SÜRFƏ", "SÜRGÜ", "SÜRMƏ", "SÜRTƏ", "SÜRVƏ", "SÜRÜM", "SÜRƏK", "SÜRƏT", "SÜSLÜ", "SÜSƏN", "SÜTUN", "SÜTÜL", "SÜXUR", "SÜZMƏ", "SÜZÜB", "SÜZÜK", "SÜZƏN", "SÜZƏR", "SÜİTA", "SİBRƏ", "SİBİR", "SİCİM", "SİDQİ", "SİDİK", "SİFON", "SİFTƏ", "SİFƏT", "SİKKƏ", "SİLAH", "SİLGİ", "SİLMƏ", "SİLOS", "SİLVİ", "SİLİB", "SİMGƏ", "SİMLİ", "SİMİC", "SİNAL", "SİNFİ", "SİNLİ", "SİNMƏ", "SİNOD", "SİNOV", "SİNQA", "SİNUS", "SİNİF", "SİNİK", "SİNİR", "SİNƏK", "SİPƏR", "SİQAR", "SİQMA", "SİRAB", "SİRAT", "SİREN", "SİRKƏ", "SİRLİ", "SİRSA", "SİRİK", "SİSLİ", "SİSTA", "SİSƏK", "SİTAL", "SİTAT", "SİTRA", "SİTTA", "SİTƏM", "SİVAS", "SİVRİ", "SİVİL", "SİYAH", "SİYAL", "SİYAS", "SİYOV", "SİZAL", "SİZCƏ", "SİZLİ", "SİÇAN", "SƏBAT", "SƏBZİ", "SƏBZƏ", "SƏBİR", "SƏBƏB", "SƏBƏT", "SƏCDƏ", "SƏDAN", "SƏDRİ", "SƏDƏF", "SƏFEH", "SƏFİL", "SƏFİR", "SƏFƏR", "SƏHNƏ", "SƏHRA", "SƏHİH", "SƏHƏR", "SƏKMƏ", "SƏKİL", "SƏLBƏ", "SƏLİB", "SƏLİS", "SƏLƏF", "SƏLƏM", "SƏMUM", "SƏMİR", "SƏMƏD", "SƏMƏN", "SƏNCƏ", "SƏNLİ", "SƏNİN", "SƏNƏD", "SƏNƏK", "SƏNƏM", "SƏNƏT", "SƏPGİ", "SƏPKİ", "SƏPMƏ", "SƏPİN", "SƏRFƏ", "SƏRGİ", "SƏRMƏ", "SƏRÇƏ", "SƏRİN", "SƏSLİ", "SƏSİN", "SƏTHİ", "SƏTRİ", "SƏTRƏ", "SƏTİN", "SƏTİR", "SƏYLİ", "SƏYLƏ", "TAALA", "TABAQ", "TABEL", "TABLI", "TABLO", "TABOR", "TABUT", "TACAO", "TACLI", "TACİK", "TACİR", "TAFTA", "TAKIR", "TAKSA", "TAKSİ", "TALAN", "TALAQ", "TALIŞ", "TALON", "TAMAH", "TAMAM", "TAMET", "TAMLI", "TAMUS", "TAMİL", "TANIQ", "TANIŞ", "TANQO", "TANRI", "TANİD", "TANİN", "TAPAN", "TAPIL", "TAPMA", "TAPQI", "TAPİR", "TAQAL", "TAQIM", "TAQƏT", "TARAC", "TARAN", "TARAP", "TARAZ", "TARAŞ", "TARIM", "TARLA", "TARLI", "TARQA", "TARÇI", "TARİF", "TARİX", "TASIZ", "TASMA", "TASUA", "TATAR", "TATAZ", "TATCA", "TATLI", "TATOY", "TAURO", "TAVAN", "TAVAR", "TAVOT", "TAXIL", "TAXMA", "TAXTA", "TAXÇA", "TAYFA", "TAYLI", "TAYQA", "TAĞAO", "TAĞAR", "TAĞLI", "TEATR", "TEDAN", "TELLİ", "TELUQ", "TELİT", "TEMBR", "TENAR", "TENOR", "TERMO", "TESLA", "TETRA", "TETİR", "TETİS", "TEXAS", "TEYXA", "TEZCƏ", "TEZİS", "TEİST", "TEİZM", "TIXAC", "TIXLI", "TIXMA", "TIĞIN", "TODAN", "TODES", "TOKİO", "TOMAT", "TOMSK", "TONAL", "TONER", "TONLU", "TONQA", "TONUS", "TONİK", "TOPAL", "TOPAZ", "TOPLU", "TOPUQ", "TOPÇU", "TOPİK", "TOQQA", "TORAN", "TORBA", "TORLU", "TORNA", "TORTA", "TORÇU", "TORİT", "TÜRMƏ", "TOTAL", "TOTEM", "TOTUQ", "TOVUZ", "TOXAC", "TOXAR", "TOXUM", "TOYLU", "TOYUQ", "TOZAO", "TOZLU", "TOĞAY", "TOĞLU", "TRAGİ", "TRAMP", "TRANK", "TRANS", "TRANŞ", "TRAST", "TRATT", "TREND", "TREST", "TROMB", "TRİAL", "TRİAS", "TRİBA", "TRİKO", "TRİOD", "TRİPS", "TRİZM", "TUBUS", "TUFAN", "TUFLU", "TUFLİ", "TULUM", "TULUQ", "TUMAC", "TUMAN", "TUMAR", "TUMAS", "TUMBA", "TUMLU", "TUMOV", "TUNEL", "TUNUŞ", "TUNİS", "TUQAY", "TURAC", "TURAN", "TUREL", "TURNA", "TURNE", "TURUP", "TURŞU", "TUTAC", "TUTAM", "TUTAQ", "TUTAR", "TUTDU", "TUTMA", "TUTQU", "TUTUM", "TUTUQ", "TUTYA", "TUTÇU", "TUXTA", "TUYUQ", "TUĞLU", "TUĞRA", "TUŞLU", "TVİRL", "TVİST", "TÖHFƏ", "TÖHÜR", "TÖKMƏ", "TÖKÜB", "TÖKÜK", "TÖKÜM", "TÖRPÜ", "TÖVBƏ", "TÖVLƏ", "TÖYCÜ", "TÜBİK", "TÜKLÜ", "TÜKLƏ", "TÜKƏO", "TÜLKÜ", "TÜLLÜ", "TÜLƏK", "TÜMEN", "TÜMƏN", "TÜNER", "TÜNÜK", "TÜRBƏ", "TÜRFƏ", "TÜRKÜ", "TÜRLÜ", "TÜSTÜ", "TÜTMƏ", "TÜTOR", "TÜTÜN", "TÜTƏK", "TÜƏDO", "TİBBİ", "TİFAQ", "TİFİL", "TİKAN", "TİKER", "TİKMƏ", "TİKİB", "TİKİK", "TİKİN", "TİKİŞ", "TİLDA", "TİLLİ", "TİLOV", "TİMOL", "TİMUS", "TİMİK", "TİMİN", "TİNGƏ", "TİNLİ", "TİNTO", "TİPAJ", "TİPLİ", "TİPİK", "TİQEL", "TİRAJ", "TİRAN", "TİRLİ", "TİRMƏ", "TİTAN", "TİTUL", "TİYAN", "TİŞİK", "TƏBİB", "TƏBİL", "TƏBİR", "TƏBİİ", "TƏBƏƏ", "TƏCİL", "TƏHLƏ", "TƏHƏR", "TƏKAN", "TƏKCƏ", "TƏKKƏ", "TƏKLƏ", "TƏKNƏ", "TƏKSU", "TƏKYƏ", "TƏKİD", "TƏKƏR", "TƏLAŞ", "TƏLXƏ", "TƏLİM", "TƏLİS", "TƏLƏB", "TƏLƏF", "TƏLƏM", "TƏMAS", "TƏMİN", "TƏMİR", "TƏMİZ", "TƏMƏL", "TƏNGƏ", "TƏNHA", "TƏNLİ", "TƏNƏK", "TƏPKİ", "TƏPMƏ", "TƏPİK", "TƏPƏL", "TƏPƏR", "TƏQTİ", "TƏQİB", "TƏRKİ", "TƏRLİ", "TƏRSA", "TƏRSİ", "TƏRZİ", "TƏRİF", "TƏRƏF", "TƏRƏK", "TƏSİR", "TƏSİS", "TƏSƏK", "TƏTİK", "TƏTİL", "TƏVİL", "TƏXİR", "TƏYİN", "TƏZAD", "TƏZİM", "TƏZƏK", "TƏŞNƏ", "TƏŞƏR", "UCALA", "UCBAT", "UCDAN", "UCLUQ", "UCQAR", "UCSUZ", "UDLAQ", "UDMAQ", "UDSUZ", "UDUCU", "UDİCƏ", "UKLAD", "ULAMA", "ULAŞA", "ULDUZ", "ULTRA", "ULVİT", "UMBRA", "UMMAQ", "UMSUQ", "UMTUL", "UNLUQ", "UNSUZ", "UNİYA", "URTUQ", "URVAT", "USTAD", "UTANA", "UTANC", "UYMAQ", "UYUMA", "UYĞUN", "UYĞUR", "UZADA", "UZADI", "UZANA", "UZAĞA", "UZAĞI", "UZMAN", "UÇMAQ", "UÇQUN", "UÇUCU", "UÇUNA", "UÇURA", "UŞQUN", "UŞUÇU", "VACİB", "VADAR", "VADZA", "VAFLİ", "VAHİD", "VALAY", "VALEH", "VALET", "VALLİ", "VALTA", "VALUN", "VAMLA", "VANNA", "VANİL", "VAPOR", "VAQON", "VAQİF", "VAQİƏ", "VARAN", "VARLI", "VARMA", "VARİD", "VARİS", "VASİL", "VATİN", "VAYAO", "VAYLI", "VAĞAM", "VAŞAQ", "VEDRƏ", "VELÜR", "VENED", "VENET", "VENOZ", "VEQAS", "VERGİ", "VERMƏ", "VERST", "VERİL", "VERİM", "VERİR", "VERİŞ", "VEYİL", "VIŞKA", "VOKAL", "VOLOF", "VOLTA", "VOTUM", "VURAN", "VURMA", "VURUB", "VURUQ", "VURUŞ", "VURĞU", "VYANA", "VZVOD", "VÜCUD", "VÜQAR", "VÜSAL", "VÜSƏT", "VİDEO", "VİLLA", "VİNİL", "VİOLA", "VİRAJ", "VİRAN", "VİRUS", "VİSKİ", "VİTSE", "VİYƏN", "VİZAJ", "VİZİR", "VİZİT", "VİŞNƏ", "VƏFAT", "VƏHŞİ", "VƏKİL", "VƏLÇİ", "VƏLİM", "VƏLƏK", "VƏLƏS", "VƏQFİ", "VƏRNİ", "VƏROV", "VƏRƏM", "VƏRƏQ", "VƏSFİ", "VƏSMƏ", "VƏTƏN", "VƏTƏR", "VƏZİR", "XADİM", "XAHİŞ", "XAKAS", "XALAT", "XALLI", "XALTA", "XALÇA", "XALİQ", "XALİS", "XAMIT", "XAMNA", "XANIM", "XAPAN", "XAQAN", "XARAB", "XARAL", "XARÇO", "XARİC", "XASSƏ", "XATIN", "XATUN", "XATİR", "XAVRA", "XAXAM", "XAÇLI", "XAŞAL", "XEYLİ", "XEYİR", "XIDIR", "XILLI", "XILTA", "XILXA", "XIMIR", "XIRDA", "XIRIM", "XIRXA", "XIRXI", "XIRÇI", "XISIN", "XIŞLI", "XIŞMA", "XOCİK", "XOFLU", "XONSA", "XONÇA", "XOREY", "XORNA", "XORUM", "XORUZ", "XORÇU", "XOVLU", "XOYLU", "XOZAN", "XOŞCA", "XOŞÜZ", "XUDAT", "XULUF", "XUMAR", "XUNTA", "XURAY", "XURMA", "XURUŞ", "XUTOR", "XÖRƏK", "XÖTƏK", "XÜLYA", "XÜSUS", "XÜTBƏ", "XİAZM", "XİLAF", "XİLAS", "XİRQƏ", "XİTAB", "XİTAM", "XİTON", "XİTİN", "XİYAR", "XİZƏK", "XƏBİS", "XƏBƏR", "XƏCİL", "XƏDİM", "XƏFİF", "XƏLQİ", "XƏLƏC", "XƏLƏF", "XƏLƏL", "XƏLƏT", "XƏMRƏ", "XƏMSİ", "XƏMİR", "XƏRAC", "XƏRİF", "XƏRƏK", "XƏSTƏ", "XƏSİL", "XƏSİS", "XƏTAİ", "XƏTLİ", "XƏTMİ", "XƏTTİ", "XƏTİB", "XƏTİR", "XƏTƏR", "XƏYAL", "XƏZAN", "XƏZLİ", "XƏZRİ", "XƏZÇİ", "XƏZƏL", "XƏZƏR", "XƏŞİL", "XƏŞƏL", "XƏŞƏM", "YABAN", "YADLI", "YADRO", "YAKAN", "YAKUT", "YALAN", "YALAQ", "YALAX", "YALIN", "YALLI", "YALXI", "YAMAC", "YAMAN", "YAMAQ", "YANAQ", "YANAR", "YANDI", "YANIB", "YANIQ", "YANKİ", "YANLI", "YANMA", "YANÇI", "YANĞI", "YAPAQ", "YAPIQ", "YAPIŞ", "YAPMA", "YAPON", "YAQUT", "YARAM", "YARAQ", "YARIM", "YARIQ", "YARIŞ", "YARLI", "YARMA", "YARUS", "YASAB", "YASAQ", "YASLI", "YASTI", "YASİN", "YATAB", "YATAQ", "YATIM", "YATIQ", "YATIR", "YATIŞ", "YATMA", "YATSI", "YAVAN", "YAVAŞ", "YAVRU", "YAVUQ", "YAVƏR", "YAXAC", "YAXAR", "YAXIB", "YAXIN", "YAXIQ", "YAXMA", "YAXTA", "YAXUD", "YAXŞI", "YAYAQ", "YAYCI", "YAYIM", "YAYIN", "YAYIQ", "YAYLA", "YAYLI", "YAYMA", "YAYÇI", "YAYĞI", "YAZAN", "YAZAR", "YAZDA", "YAZIB", "YAZIM", "YAZIQ", "YAZLI", "YAZMA", "YAĞAR", "YAĞIN", "YAĞIR", "YAĞIŞ", "YAĞLI", "YAĞMA", "YAĞÇI", "YAŞAM", "YAŞAR", "YAŞID", "YAŞIL", "YAŞLI", "YAŞMA", "YEDDİ", "YEDƏK", "YEGER", "YEKUN", "YELBƏ", "YELDA", "YELGƏ", "YELLİ", "YELİN", "YELƏK", "YELƏN", "YEMLİ", "YEMÇİ", "YEMİŞ", "YEMƏK", "YENGƏ", "YENMƏ", "YENOT", "YERFİ", "YERLİ", "YERİK", "YERİŞ", "YESİR", "YETKİ", "YETMƏ", "YETİK", "YETİM", "YETƏN", "YETƏR", "YEYİB", "YEYİM", "YEYİN", "YEZNƏ", "YEŞİK", "YIXIQ", "YIXMA", "YIĞIB", "YIĞIM", "YIĞIN", "YIĞIŞ", "YIĞMA", "YODAT", "YODLU", "YOLAQ", "YOLKA", "YOLLU", "YOLMA", "YOLPA", "YOLUQ", "YOLÇU", "YONCA", "YONMA", "YONQU", "YONUB", "YONUQ", "YONUŞ", "YORMA", "YORTA", "YORUB", "YORĞA", "YOSMA", "YOSUN", "YOXSA", "YOXUŞ", "YOZMA", "YOZUB", "YOZUM", "YOĞUN", "YUBKA", "YUKKA", "YULAF", "YULAN", "YULUR", "YUMAQ", "YUMMA", "YUMOR", "YUMRU", "YUMUB", "YUMUQ", "YUNAN", "YUNLU", "YUNQA", "YUNÇU", "YUTUB", "YUVAQ", "YUYUB", "YUYUM", "YÖNLÜ", "YÖNÜM", "YÜKLÜ", "YÜKÇÜ", "YÜRÜK", "YÜRÜŞ", "YÜYƏN", "YÜZCƏ", "YÜZƏR", "YİVLİ", "YƏHƏR", "YƏMƏN", "YƏQİN", "YƏŞƏM", "ZABUX", "ZABİT", "ZAHİD", "ZAHİR", "ZAKİR", "ZALAM", "ZALIM", "ZALOM", "ZALXA", "ZAMAN", "ZAMİN", "ZAPAL", "ZARAT", "ZATƏN", "ZAVAL", "ZAVOD", "ZAÇOT", "ZAĞCA", "ZAĞLI", "ZEFİR", "ZEHLİ", "ZEHNİ", "ZEHİN", "ZENİT", "ZERTİ", "ZEVİN", "ZEYVƏ", "ZILIR", "ZINBA", "ZIRPI", "ZIĞLI", "ZOBLU", "ZODLU", "ZOLAQ", "ZOMBİ", "ZONAL", "ZORBA", "ZORLA", "ZORLU", "ZOĞAL", "ZOĞLU", "ZUBUL", "ZURNA", "ZÖKƏM", "ZÖVCƏ", "ZÖVLƏ", "ZÜHUR", "ZÜLAL", "ZÜLÜM", "ZÜMRƏ", "ZÜVÜS", "ZÜYÇÜ", "ZİBİL", "ZİFAF", "ZİLLİ", "ZİNƏT", "ZİREH", "ZİRVƏ", "ZİRİK", "ZİRƏK", "ZİVEL", "ZİYAD", "ZİYAN", "ZİYİL", "ZƏBUR", "ZƏFƏR", "ZƏHLƏ", "ZƏHƏR", "ZƏKAT", "ZƏLKİ", "ZƏLİL", "ZƏMİN", "ZƏNCİ", "ZƏNGİ", "ZƏNLƏ", "ZƏRBİ", "ZƏRBƏ", "ZƏRDƏ", "ZƏRLİ", "ZƏRRƏ", "ZƏRİF", "ZƏRƏR", "ZƏYLİ", "ZƏYƏM", "ÇADIR", "ÇADRA", "ÇALAN", "ÇALAR", "ÇALDI", "ÇALIB", "ÇALIN", "ÇALIŞ", "ÇALLI", "ÇALMA", "ÇALOV", "ÇALĞI", "ÇAMIR", "ÇANAQ", "ÇANTA", "ÇAPAQ", "ÇAPAR", "ÇAPIB", "ÇAPIQ", "ÇAPIŞ", "ÇAPLI", "ÇAPMA", "ÇAPÇI", "ÇARAH", "ÇARIQ", "ÇARPA", "ÇARSU", "ÇARUK", "ÇARXI", "ÇARŞI", "ÇATAL", "ÇATAQ", "ÇATAR", "ÇATIB", "ÇATIQ", "ÇATIŞ", "ÇATLI", "ÇATMA", "ÇATQI", "ÇAVUŞ", "ÇAXIR", "ÇAXIŞ", "ÇAXMA", "ÇAYAN", "ÇAYIR", "ÇAYLI", "ÇAYÇI", "ÇAĞIR", "ÇAĞLI", "ÇAĞRI", "ÇAŞIR", "ÇAŞMA", "ÇEVRƏ", "ÇEVİK", "ÇEVİR", "ÇEXCƏ", "ÇEXOL", "ÇEZMƏ", "ÇEÇEN", "ÇEŞMƏ", "ÇEŞNİ", "ÇEŞİD", "ÇILIN", "ÇIRAQ", "ÇIRPA", "ÇIRPI", "ÇIVAN", "ÇIXAN", "ÇIXAR", "ÇIXIM", "ÇIXIQ", "ÇIXIŞ", "ÇIXMA", "ÇIĞIR", "ÇIĞLI", "ÇOBAN", "ÇOCUQ", "ÇOLAQ", "ÇOLMA", "ÇOLPA", "ÇOLPI", "ÇOLUM", "ÇOLUQ", "ÇOMAQ", "ÇOMUL", "ÇOPUR", "ÇOTUR", "ÇOXLU", "ÇOĞAN", "ÇUBUQ", "ÇUKÇA", "ÇULAN", "ÇULLU", "ÇULÇU", "ÇUQUN", "ÇUTQU", "ÇUVAL", "ÇUVAŞ", "ÇUXUR", "ÇUĞUL", "ÇÖHRƏ", "ÇÖKMƏ", "ÇÖKÜK", "ÇÖKÜŞ", "ÇÖKƏK", "ÇÖLLÜ", "ÇÖLMƏ", "ÇÖLÇÜ", "ÇÖMÇƏ", "ÇÖNMƏ", "ÇÖNÜK", "ÇÖPLÜ", "ÇÖPRƏ", "ÇÖPÇÜ", "ÇÖPÜK", "ÇÖRƏK", "ÇÖZMƏ", "ÇÖZÜM", "ÇÜNKİ", "ÇÜRÜK", "ÇÜYLÜ", "ÇİBAN", "ÇİBİN", "ÇİGİL", "ÇİLLİ", "ÇİLLƏ", "ÇİLOV", "ÇİLİK", "ÇİMLİ", "ÇİMMƏ", "ÇİMİR", "ÇİNAR", "ÇİNCƏ", "ÇİNLİ", "ÇİPLİ", "ÇİRİŞ", "ÇİSLİ", "ÇİSƏK", "ÇİTƏK", "ÇİVZƏ", "ÇİVİR", "ÇİYAN", "ÇİYLİ", "ÇİYNİ", "ÇİYİD", "ÇİYİN", "ÇİÇƏK", "ÇƏKMƏ", "ÇƏKİC", "ÇƏKİK", "ÇƏKİL", "ÇƏKİM", "ÇƏKİŞ", "ÇƏLİK", "ÇƏLİM", "ÇƏMƏN", "ÇƏNGİ", "ÇƏNGƏ", "ÇƏNLİ", "ÇƏPLİ", "ÇƏPİK", "ÇƏPİŞ", "ÇƏPƏL", "ÇƏPƏR", "ÇƏRTƏ", "ÇƏRXİ", "ÇƏRÇİ", "ÇƏRƏK", "ÇƏRƏN", "ÇƏRƏZ", "ÇƏTİN", "ÇƏTİR", "ÇƏTƏN", "ÖDDƏK", "ÖDLÜK", "ÖDOTU", "ÖDSÜZ", "ÖDÜNC", "ÖDƏMƏ", "ÖDƏNC", "ÖKSÜZ", "ÖLGÜN", "ÖLMÜŞ", "ÖLMƏK", "ÖLMƏZ", "ÖLÇMƏ", "ÖLÇÜB", "ÖLƏNG", "ÖNCÜL", "ÖNDƏR", "ÖNLÜK", "ÖPMƏK", "ÖRDƏK", "ÖRKƏN", "ÖRNƏK", "ÖRPƏK", "ÖRTMƏ", "ÖRTÜB", "ÖRTÜK", "ÖTKÜN", "ÖTKƏM", "ÖTMƏK", "ÖTÜRƏ", "ÖTÜŞƏ", "ÖTƏKİ", "ÖTƏRİ", "ÖVLAD", "ÖVRƏT", "ÖYMƏK", "ÖYÜMƏ", "ÖYÜNƏ", "ÖZBƏK", "ÖZGÜN", "ÖZLÜK", "ÖZÜNÜ", "ÖZÜNƏ", "ÜFÜQİ", "ÜFÜQƏ", "ÜFÜRƏ", "ÜLFƏT", "ÜLGÜC", "ÜLKƏR", "ÜLƏMA", "ÜMMAN", "ÜMMƏT", "ÜMTÜL", "ÜMUMİ", "ÜNSÜR", "ÜNSÜZ", "ÜNVAN", "ÜRCAH", "ÜRKMƏ", "ÜRKƏK", "ÜRPMƏ", "ÜRYAN", "ÜRƏYƏ", "ÜSKÜK", "ÜSLUB", "ÜSTÜN", "ÜSULU", "ÜSULİ", "ÜSYAN", "ÜTMƏK", "ÜTÜLÜ", "ÜYÜDƏ", "ÜZDƏN", "ÜZGÜN", "ÜZGƏC", "ÜZLÜK", "ÜZMƏK", "ÜZRLÜ", "ÜZSÜZ", "ÜZÜAĞ", "ÜZÜCÜ", "ÜÇBİR", "ÜÇDİŞ", "ÜÇGÖZ", "ÜÇGÜL", "ÜÇLÜK", "ÜÇQAT", "ÜÇYAŞ", "ÜŞÜMƏ", "ÜŞÜYƏ", "ĞƏTİN", "İBARƏ", "İBLİS", "İBRƏT", "İCARƏ", "İCAZƏ", "İCBAR", "İCLAS", "İCMAL", "İDARƏ", "İDBAR", "İDDİA", "İDEAL", "İDEYA", "İDMAN", "İDRAK", "İDXAL", "İDİOM", "İDİOT", "İFADƏ", "İFAÇI", "İFFƏT", "İFLAS", "İFLİC", "İFRAT", "İFRAZ", "İFRİT", "İFTAR", "İKONA", "İKRAH", "İKRAM", "İKSİR", "İKİCƏ", "İKİDƏ", "İKİLİ", "İKİSİ", "İLAHİ", "İLAHƏ", "İLBİZ", "İLDƏN", "İLGƏK", "İLHAM", "İLHAQ", "İLKCƏ", "İLKİN", "İLLAH", "İLLİK", "İLLİT", "İLLƏT", "İLMƏK", "İLQAR", "İLYAS", "İLĞIM", "İLİSU", "İMALƏ", "İMDAD", "İMEYL", "İMKAN", "İMMUN", "İMOQO", "İMSAK", "İMƏCİ", "İNANC", "İNCİK", "İNCİL", "İNFOR", "İNKAR", "İNKİR", "İNNAB", "İNQUŞ", "İNSAF", "İNSAN", "İNSTİ", "İNTAQ", "İNTİM", "İONLU", "İONİT", "İPLİK", "İPRİT", "İPSİZ", "İPUCU", "İQBAL", "İQDIR", "İQLİM", "İQREK", "İRADİ", "İRADƏ", "İRBİS", "İRFAN", "İRQÇİ", "İRSƏN", "İRTMƏ", "İRÇAL", "İRÇAN", "İRİCƏ", "İRİLİ", "İRİŞƏ", "İRƏLİ", "İRƏMƏ", "İSALI", "İSBAT", "İSHAL", "İSKİT", "İSLAH", "İSLAM", "İSLAQ", "İSLIQ", "İSLƏT", "İSMƏT", "İSPAN", "İSPİK", "İSRAF", "İSRAR", "İSTƏK", "İSTƏR", "İSVEÇ", "İSƏVİ", "İTAƏT", "İTBAZ", "İTHAF", "İTKİN", "İTLİK", "İTMƏK", "İTOTU", "İTİLİ", "İTİRƏ", "İTİUC", "İVASİ", "İXLAS", "İXRAC", "İYSİZ", "İZAFİ", "İZAFƏ", "İZHAR", "İZMİR", "İZOLƏ", "İZSİZ", "İZZƏT", "İÇDON", "İÇLİK", "İÇMƏK", "İÇSİZ", "İÇİCİ", "İÇİRƏ", "İÇƏRİ", "İŞARƏ", "İŞBAZ", "İŞCİL", "İŞDİR", "İŞGİL", "İŞLƏK", "İŞLƏN", "İŞLƏR", "İŞRƏT", "İŞSİZ", "İŞĞAL", "İŞİAS", "İŞİNƏ", "ŞABAŞ", "ŞABER", "ŞABOT", "ŞAHAD", "ŞAHİD", "ŞAHİN", "ŞAKƏR", "ŞALAQ", "ŞALLI", "ŞALÇI", "ŞAMAN", "ŞAMLI", "ŞAMOT", "ŞAMÇI", "ŞAMİL", "ŞANKR", "ŞANLI", "ŞANTİ", "ŞAPKA", "ŞAQQA", "ŞAQUL", "ŞARAQ", "ŞARLI", "ŞASSE", "ŞASSİ", "ŞATIR", "ŞAXLI", "ŞAXTA", "ŞAYAN", "ŞAYBA", "ŞAYİƏ", "ŞAĞAN", "ŞAİRİ", "ŞEHLİ", "ŞEKEL", "ŞENSİ", "ŞERBA", "ŞERMA", "ŞEVER", "ŞEVRO", "ŞEYDA", "ŞEYXİ", "ŞEŞLİ", "ŞINIX", "ŞIRIL", "ŞIRIM", "ŞIRTI", "ŞIXLI", "ŞKALA", "ŞKANS", "ŞLANQ", "ŞLEYF", "ŞLİST", "ŞLİXT", "ŞOMAJ", "ŞORAN", "ŞORBA", "ŞORCA", "ŞORLU", "ŞORNU", "ŞORSU", "ŞORĞA", "ŞOTKA", "ŞOUÇU", "ŞOŞON", "ŞPAQA", "ŞPROT", "ŞPRİS", "ŞPUNT", "ŞRİFT", "ŞTAMB", "ŞTAMP", "ŞTANQ", "ŞTREK", "ŞTRİX", "ŞTURM", "ŞTİFT", "ŞTİRİ", "ŞUDUQ", "ŞULUQ", "ŞUMAL", "ŞUMER", "ŞURUD", "ŞURUP", "ŞUĞUL", "ŞVART", "ŞVİTS", "ŞÖLƏN", "ŞÜALI", "ŞÜBHƏ", "ŞÜKÜM", "ŞÜKÜR", "ŞÜLPƏ", "ŞÜMŞƏ", "ŞÜRÜK", "ŞÜTTE", "ŞÜTÜK", "ŞÜURİ", "ŞÜVÜL", "ŞÜYÜD", "ŞÜYÜL", "ŞİBER", "ŞİBYƏ", "ŞİFER", "ŞİFON", "ŞİKAR", "ŞİLLƏ", "ŞİLTƏ", "ŞİMAL", "ŞİNEL", "ŞİNLİ", "ŞİNQL", "ŞİNÇİ", "ŞİRLİ", "ŞİRMA", "ŞİRNİ", "ŞİRÇİ", "ŞİRİN", "ŞİTİL", "ŞİVLİ", "ŞİVÇƏ", "ŞİVƏN", "ŞİXTA", "ŞİYAV", "ŞİŞLİ", "ŞİŞMƏ", "ŞİŞİK", "ŞİŞƏK", "ŞƏBİH", "ŞƏFƏQ", "ŞƏHLA", "ŞƏHRƏ", "ŞƏHİD", "ŞƏHƏR", "ŞƏKLİ", "ŞƏKİL", "ŞƏKƏR", "ŞƏLPƏ", "ŞƏLTƏ", "ŞƏMSİ", "ŞƏNBƏ", "ŞƏRAB", "ŞƏRLİ", "ŞƏRQİ", "ŞƏRTİ", "ŞƏRUR", "ŞƏRÇİ", "ŞƏRİF", "ŞƏRİK", "ŞƏRİR", "ŞƏRƏF", "ŞƏVƏL", "ŞƏXSİ", "ƏBALI", "ƏBCƏD", "ƏBLƏH", "ƏBRƏŞ", "ƏBƏBƏ", "ƏBƏDİ", "ƏBƏÇİ", "ƏCAİB", "ƏCDAD", "ƏCLAF", "ƏCƏBA", "ƏCƏMİ", "ƏDALI", "ƏDDİS", "ƏDƏBİ", "ƏDƏDİ", "ƏFQAN", "ƏFSUN", "ƏFSUS", "ƏFĞAN", "ƏFŞAR", "ƏHALİ", "ƏHATƏ", "ƏHMƏD", "ƏHSƏN", "ƏHVAL", "ƏHƏNG", "ƏKLİL", "ƏKMƏK", "ƏKMƏZ", "ƏKSƏR", "ƏKİLİ", "ƏLAQƏ", "ƏLAVƏ", "ƏLAÇI", "ƏLBİR", "ƏLBƏT", "ƏLCƏK", "ƏLHƏD", "ƏLLİK", "ƏLSİZ", "ƏLVAN", "ƏLÇİM", "ƏLƏMƏ", "ƏLƏVİ", "ƏMCƏK", "ƏMGƏK", "ƏMLAK", "ƏMLİK", "ƏMMAN", "ƏMMƏK", "ƏMRLİ", "ƏMSAL", "ƏMTƏƏ", "ƏMZİK", "ƏMİLİ", "ƏMİRİ", "ƏMƏLİ", "ƏMƏLƏ", "ƏMƏVİ", "ƏNBƏR", "ƏNCAM", "ƏNCİR", "ƏNDAM", "ƏNGİN", "ƏNGƏL", "ƏNLİK", "ƏNTİQ", "ƏNTƏR", "ƏNVƏR", "ƏNƏNƏ", "ƏPPƏK", "ƏQLCƏ", "ƏQLƏN", "ƏQRƏB", "ƏQİDƏ", "ƏRAZİ", "ƏRBAB", "ƏRBAZ", "ƏRDƏM", "ƏRGİN", "ƏRGƏC", "ƏRGƏN", "ƏRKAN", "ƏRKLİ", "ƏRKLƏ", "ƏRLİK", "ƏRPLİ", "ƏRSİN", "ƏRSİZ", "ƏRZAQ", "ƏRİZƏ", "ƏRƏFƏ", "ƏSALI", "ƏSBAB", "ƏSGƏR", "ƏSKİK", "ƏSLƏN", "ƏSMƏK", "ƏSMƏR", "ƏSNƏK", "ƏSRİN", "ƏSƏBİ", "ƏTALI", "ƏTBAŞ", "ƏTLİK", "ƏTRAF", "ƏTSİZ", "ƏTTAR", "ƏTƏNƏ", "ƏVVƏL", "ƏVƏZİ", "ƏXLAQ", "ƏYANİ", "ƏYLİS", "ƏYLƏC", "ƏYMƏK", "ƏYRİM", "ƏYYAM", "ƏYYAR", "ƏYYAŞ", "ƏYİLƏ", "ƏZALI", "ƏZBƏR", "ƏZGİL", "ƏZGİN", "ƏZMLİ", "ƏZMƏK", "ƏZİCİ", "ƏZİLİ", "ƏZƏLİ", "ƏZƏLƏ", "ƏŞRƏF"];
const VALID_SET = new Set(WORD_LIST);

// ── Supabase client + edge functions ──────────────────
// Moved up front (was previously declared near the auth code, further down)
// so initGame() can call the daily-guess edge function on page load without
// hitting a temporal-dead-zone error.
const SUPABASE_URL  = 'https://krrzidmvtudulflxzrqj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtycnppZG12dHVkdWxmbHh6cnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NTQ1NzYsImV4cCI6MjA5ODAzMDU3Nn0.zj6zfL7WsCugBGi5rjLbBQ-wmt6Q4q-lNNxc72M8Vj4';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

async function callSozleFunction(name, payload) {
  const { data: { session } } = await db.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session ? session.access_token : SUPABASE_ANON}`,
      'apikey': SUPABASE_ANON
    },
    body: JSON.stringify(payload || {})
  });
  // Expected errors (already_finished, rate_limited, not_in_list, ...) come
  // back as a non-2xx status with a { error } body, and callers key off
  // that .error field rather than a thrown exception — so this doesn't
  // throw on !res.ok, it'd break every one of those call sites. What it
  // does fix: a response that's non-JSON, empty, or non-ok with no .error
  // field used to parse as `{}`/null and get treated as "success with no
  // data" by callers that only check for specific known error strings.
  const body = await res.json().catch(() => null);
  if (!res.ok && !(body && body.error)) {
    return { error: `${name}_failed_${res.status}` };
  }
  return body ?? { error: `${name}_empty_response` };
}

const WIN_MSG  = ["Təbriklərrr!", "Halaldır!", "Bu işi bacarırsan!", "Əlasan!", "Babat"];
const LOSE_MSG = ["Bu səfər alınmadı :( Söz: ", "Məğlub oldun. Söz: ", "Növbəti dəfə bacaracaqsan! Söz: ", "Çətin idi, hə? Söz: ", "Yenə cəhd et! Söz: "];

const KB_ROWS = [
  ["Q", "Ü", "E", "R", "T", "Y", "U", "İ", "O", "P", "Ö", "Ğ"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "I", "Ə"],
  ["SİL", "Z", "X", "C", "V", "B", "N", "M", "Ç", "Ş", "DAXİL ET"]
];

let target = "", currentRow = 0, currentCol = 0, gameOver = false, mode = "daily", revealing = false;
let dailyCompleted = false, dailyWord = "";
let board = Array.from({ length: 6 }, () => Array(5).fill(""));
let keyStates = {};
let submittedGuesses = new Set();
let boardReady = false; // false while restoreDailyStatus() is in flight for daily mode

function setMode(m) {
  mode = m;
  document.getElementById('btn-daily').classList.toggle('active', m === 'daily');
  document.getElementById('btn-random').classList.toggle('active', m === 'random');
  initGame();
  updateRevealBtn();
  // restoreDailyStatus() previously only ran once at initial page load, so
  // switching to random and back to daily wiped the restored guesses back
  // to a blank board even though dailyCompleted (and the lock icon) still
  // correctly remembered the day was finished — an inconsistent UI state.
  if (m === 'daily') restoreDailyStatus();
}

function initGame() {
  // Daily mode's target is never computed client-side (it used to be
  // `WORD_LIST[dailyIndexFormula]`, which anyone could run in devtools to
  // read today's — or any future day's — answer). It's evaluated guess by
  // guess on the server instead; see submitRow()/sozle-guess.
  target = mode === 'random' ? WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)] : "";
  currentRow = 0; currentCol = 0; gameOver = false; revealing = false; submittedGuesses = new Set();
  board = Array.from({ length: 6 }, () => Array(5).fill(""));
  keyStates = {};
  // Daily mode's board isn't interactive until restoreDailyStatus() has
  // had a chance to replay any already-submitted guesses — otherwise
  // typing during that fetch gets silently overwritten (currentRow/board
  // get hard-reset once the restore resolves) and currentCol ends up
  // pointing past a row that now looks blank. Random mode has nothing to
  // restore, so it's always immediately interactive.
  boardReady = mode !== 'daily';
  renderGrid();
  renderKeyboard();
}

function renderGrid() {
  const g = document.getElementById('grid');
  g.innerHTML = '';
  for (let r = 0; r < 6; r++) {
    const row = document.createElement('div');
    row.className = 'row'; row.id = 'row-' + r;
    for (let c = 0; c < 5; c++) {
      const t = document.createElement('div');
      t.className = 'tile'; t.id = `tile-${r}-${c}`;
      row.appendChild(t);
    }
    g.appendChild(row);
  }
}

function renderKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  KB_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    row.forEach(k => {
      const btn = document.createElement('button');
      const isDelete = k === 'SİL';
      const isEnter  = k === 'DAXİL ET';
      btn.className = 'key' + (isDelete || isEnter ? ' wide' : '');
      btn.textContent = k;
      btn.id = 'key-' + k;
      if (keyStates[k]) btn.classList.add(keyStates[k]);
      if (isDelete)     btn.addEventListener('click', deleteLetter);
      else if (isEnter) btn.addEventListener('click', submitRow);
      else              btn.addEventListener('click', () => handleKey(k));
      rowEl.appendChild(btn);
    });
    kb.appendChild(rowEl);
  });
}

function updateTile(r, c, letter) {
  const t = document.getElementById(`tile-${r}-${c}`);
  t.textContent = letter;
  t.classList.toggle('filled', !!letter);
}

function deleteLetter() {
  if (!boardReady || gameOver || revealing) return;
  if (currentCol > 0) {
    currentCol--;
    board[currentRow][currentCol] = "";
    updateTile(currentRow, currentCol, "");
  }
}

function handleKey(k) {
  if (!boardReady || gameOver || revealing) return;
  if (k.length === 1 && currentCol < 5) {
    board[currentRow][currentCol] = k;
    updateTile(currentRow, currentCol, k);
    currentCol++;
  }
}

async function submitRow() {
  if (!boardReady || gameOver || revealing) return;
  if (currentCol < 5) { showToast("5 hərf daxil edin!"); shakeRow(currentRow); return; }
  const guess = board[currentRow].join('');
  if (!VALID_SET.has(guess)) { showToast("Söz tapılmadı!"); shakeRow(currentRow); return; }
  if (submittedGuesses.has(guess)) { showToast("Bu sözü artıq yoxladınız!"); shakeRow(currentRow); return; }

  let result;
  if (mode === 'daily') {
    revealing = true; // block further input while we wait on the network
    let res;
    try {
      res = await callSozleFunction('sozle-guess', { guess, attemptNumber: currentRow + 1 });
    } catch (e) {
      console.error('sozle-guess failed:', e);
      revealing = false;
      showToast("Xəta baş verdi, yenidən cəhd edin.");
      return;
    }
    revealing = false;
    if (res.error === 'already_finished') {
      // The server already considers today done (e.g. finished on another
      // tab/device, or restoreDailyStatus() silently failed on load) but
      // this tab's state doesn't know it yet. Re-pull the real state
      // instead of just freezing input — otherwise dailyCompleted/dailyWord
      // never get set and the reveal button stays locked forever.
      showToast("Günlük oyun artıq bitib.");
      gameOver = true;
      await restoreDailyStatus();
      return;
    }
    if (res.error) { showToast("Xəta baş verdi, yenidən cəhd edin."); return; }
    result = res.result;
    if (res.finished) dailyWord = res.word;
  } else {
    result = evaluateGuess(guess);
  }

  submittedGuesses.add(guess);
  revealRow(currentRow, result, () => {
    updateKeyStates(board[currentRow], result);
    renderKeyboard();
    if (result.every(r => r === 'correct')) {
      gameOver = true;
      setTimeout(() => { showToast(WIN_MSG[Math.floor(Math.random() * WIN_MSG.length)], 3000); unlockReveal(true); }, 400);
    } else if (currentRow === 5) {
      gameOver = true;
      const revealedWord = mode === 'daily' ? (dailyWord || '') : target;
      setTimeout(() => { showToast(LOSE_MSG[Math.floor(Math.random() * LOSE_MSG.length)] + revealedWord, 4000); unlockReveal(false); }, 400);
    }
    currentRow++; currentCol = 0;
  });
}

function evaluateGuess(guess) {
  const res = Array(5).fill('absent');
  const tArr = target.split(''), gArr = guess.split(''), used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (gArr[i] === tArr[i]) { res[i] = 'correct'; used[i] = true; }
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === 'correct') continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && gArr[i] === tArr[j]) { res[i] = 'present'; used[j] = true; break; }
    }
  }
  return res;
}

function revealRow(row, result, cb) {
  revealing = true;
  result.forEach((res, i) => {
    setTimeout(() => {
      const t = document.getElementById(`tile-${row}-${i}`);
      t.classList.add('reveal');
      setTimeout(() => { t.classList.add(res); t.classList.remove('reveal'); }, 250);
    }, i * 300);
  });
  setTimeout(() => { revealing = false; cb(); }, result.length * 300 + 300);
}

function updateKeyStates(letters, results) {
  const p = { correct: 3, present: 2, absent: 1 };
  letters.forEach((l, i) => {
    const cur = keyStates[l];
    if (!cur || (p[results[i]] || 0) > (p[cur] || 0)) keyStates[l] = results[i];
  });
}

function shakeRow(r) {
  document.getElementById('row-' + r).querySelectorAll('.tile').forEach(t => {
    t.classList.remove('shake');
    void t.offsetWidth;
    t.classList.add('shake');
    setTimeout(() => t.classList.remove('shake'), 500);
  });
}

let toastTimer;
function showToast(msg, dur = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), dur);
}

function initReveal() {
  const months = ['Yanvar','Fevral','Mart','Aprel','May','İyun','İyul','Avqust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
  const d = new Date();
  document.getElementById('reveal-date').textContent =
    `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  document.getElementById('reveal-panel').style.display = 'none';
}

// Holds a just-finished daily result for a guest until they sign up/in, so
// the game that motivated the signup isn't silently dropped from their
// stats (previously: recordSozleGame() no-op'd because sozleUser was still
// null at this point, and nothing retried it after auth completed).
let pendingGameResult = null;

function unlockReveal(won = false) {
  if (mode !== 'daily') return;
  dailyCompleted = true;
  // dailyWord is set by submitRow() from the server's response — the
  // client never computes/holds the answer itself in daily mode.
  updateRevealBtn();
  if (sozleUser) {
    recordSozleGame(won);
  } else {
    pendingGameResult = won;
    setTimeout(showSavePrompt, 2000);
  }
}

function flushPendingGameResult() {
  if (pendingGameResult !== null) {
    recordSozleGame(pendingGameResult);
    pendingGameResult = null;
  }
}

function showSavePrompt() {
  document.getElementById('sozleSavePrompt').classList.remove('hidden');
  document.getElementById('sozleSaveYes').onclick = () => {
    document.getElementById('sozleSavePrompt').classList.add('hidden');
    showAuthModal();
  };
  document.getElementById('sozleSaveNo').onclick = () => {
    document.getElementById('sozleSavePrompt').classList.add('hidden');
  };
}

function updateRevealBtn() {
  const btn   = document.getElementById('reveal-btn');
  const lock  = document.getElementById('reveal-lock');
  const panel = document.getElementById('reveal-panel');
  if (dailyCompleted) {
    btn.classList.add('unlocked');
    lock.textContent = '👁 Günün sözünü gör';
  } else {
    btn.classList.remove('unlocked');
    lock.textContent = '🔒 Oyunu bitir';
    panel.style.display = 'none';
  }
}

function toggleReveal() {
  if (!dailyCompleted) { showToast("Günlük oyunu bitir!"); return; }
  const panel = document.getElementById('reveal-panel');
  const word  = document.getElementById('reveal-word');
  const lock  = document.getElementById('reveal-lock');
  if (panel.style.display === 'none') {
    word.textContent = dailyWord;
    panel.style.display = 'flex';
    lock.textContent = '🔼 Gizlə';
  } else {
    panel.style.display = 'none';
    lock.textContent = '👁 Günün sözünü gör';
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  document.body.classList.toggle('light');
}

function showHelp()  { document.getElementById('modal').style.display = 'flex'; }
function closeModal(){
  document.getElementById('modal').style.display = 'none';
  localStorage.setItem('sozle_seen_help', '1');
}

function maybeShowHelp() {
  if (!localStorage.getItem('sozle_seen_help')) showHelp();
}

document.addEventListener('keydown', e => {
  // Don't intercept keys when user is typing in an input or a modal is open
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const overlays = document.querySelectorAll('.sozle-auth-overlay, .modal-overlay');
  if ([...overlays].some(el => !el.classList.contains('hidden') && el.style.display !== 'none')) return;

  if (e.key === 'Backspace') { deleteLetter(); return; }
  if (e.key === 'Enter')     { submitRow(); return; }
  const k = e.key.toUpperCase();
  const allKeys = KB_ROWS.flat().filter(x => x !== 'SİL' && x !== 'DAXİL ET');
  if (allKeys.includes(k)) handleKey(k);
});

initGame();
initReveal();
maybeShowHelp();

// ── Supabase Auth + Streak ─────────────────────────────
// (db / SUPABASE_URL / SUPABASE_ANON are declared near the top of the file now)

let sozleUser = null, sozleProfile = null, selectedAvatar = '👦';

// Azerbaijani-aware case folding. JS's default (locale-unaware) toLowerCase()
// turns 'İ' into 'i̇' (i + combining dot above, 2 codepoints) instead of 'i',
// and doesn't map 'I' to the dotless 'ı'. Left unhandled, two names typed
// with different I variants (e.g. "İlqar" vs "Ilqar") hash to different
// emails and land on different accounts, breaking the uniqueness check.
// .normalize('NFC') first for the same reason: two visually-identical names
// that differ only in Unicode composition (a combining accent vs. a single
// precomposed character) would otherwise hash to different emails too —
// same duplicate-account vector, just via composition instead of casing.
function azLower(s) {
  return s.normalize('NFC').replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
}

async function nameToEmail(name) {
  const data = new TextEncoder().encode(azLower(name));
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex  = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('').slice(0,32);
  return hex + '@ingilisce.app';
}

function validatePassword(pwd) {
  if (pwd.length < 8)             return 'Şifrə ən az 8 simvol olmalıdır.';
  if (!/[A-Z]/.test(pwd))         return 'Ən az bir böyük hərf olmalıdır.';
  if (!/[!@#$%^&*()_+\-=\[\]{};:"\\|,.<>\/?]/.test(pwd)) return 'Ən az bir xüsusi simvol lazımdır.';
  return null;
}

async function upsertProfile(userId, name, avatar) {
  const newProfile = { display_name: name, avatar, sozle_streak: 0, sozle_last_played: null, sozle_games_played: 0, sozle_games_won: 0 };
  const { error } = await db.from('sozle_profiles').insert({ id: userId, ...newProfile });
  if (error) throw new Error(error.message);
  return newProfile;
}

// Render-time escaping (esc(), used in loadLeaderboard) already stops the
// XSS payload from executing, but rejecting HTML-meaningful characters here
// too is defense in depth — it also blocks homoglyph/impersonation-style
// display names outright instead of just neutering their markup.
const NAME_RE = /^[A-Za-zƏəÇçĞğIıİiÖöŞşÜü0-9 ._-]{1,24}$/;

async function doSignUp(name, avatar, pwd, confirm) {
  if (!name.trim())    throw new Error('Ad daxil edin.');
  if (!NAME_RE.test(name.trim())) throw new Error('Ad yalnız hərf, rəqəm, boşluq, defis, alt xətt və nöqtədən ibarət ola bilər.');
  const pwdErr = validatePassword(pwd);
  if (pwdErr)          throw new Error(pwdErr);
  if (pwd !== confirm) throw new Error('Şifrələr uyğun gəlmir.');

  // Routed through sozle-check-username (rate-limited) instead of calling
  // the public is_sozle_username_available RPC directly — that RPC has no
  // throttling, and combined with nameToEmail's deterministic hash it lets
  // anyone bulk-enumerate which candidate names already have accounts.
  const checkRes = await callSozleFunction('sozle-check-username', { uname: azLower(name) });
  if (checkRes && checkRes.error === 'rate_limited') throw new Error('Çox cəhd etdiniz, bir az sonra yenidən cəhd edin.');
  if (!checkRes || !checkRes.available)              throw new Error('Bu ad artıq istifadə olunur.');

  const email = await nameToEmail(name);
  const { data, error } = await db.auth.signUp({ email, password: pwd });

  // Auth user exists under this email already. Two distinct cases land here
  // and look identical from the client's perspective:
  //   1. You recovering your own orphaned account (profile row never got
  //      created after a previous signup that errored out).
  //   2. A name collision: someone else grabbed this name between the
  //      availability check above and this signUp call (TOCTOU race).
  // Signing in tells them apart, but a failed sign-in here doesn't
  // necessarily mean "wrong password" — it may just as well mean the name
  // is already someone else's, so the message stays intentionally generic.
  if (error && error.message.toLowerCase().includes('already registered')) {
    const { data: sd, error: se } = await db.auth.signInWithPassword({ email, password: pwd });
    if (se) throw new Error('Bu ad artıq istifadə olunur və ya şifrə yanlışdır.');
    const { data: existing } = await db.from('sozle_profiles').select('*').eq('id', sd.user.id).single();
    if (existing) return { user: sd.user, profile: existing };
    const profile = await upsertProfile(sd.user.id, name, avatar);
    return { user: sd.user, profile };
  }
  if (error) throw new Error(error.message);

  const profile = await upsertProfile(data.user.id, name, avatar);
  return { user: data.user, profile };
}

async function doSignIn(name, pwd) {
  if (!name.trim()) throw new Error('Ad daxil edin.');
  if (!pwd)         throw new Error('Şifrə daxil edin.');
  const email = await nameToEmail(name);
  const { data, error } = await db.auth.signInWithPassword({ email, password: pwd });
  if (error) throw new Error(error.message);
  const { data: profile } = await db.from('sozle_profiles').select('*').eq('id', data.user.id).single();
  // Profile missing — orphaned auth user, create the row now
  if (!profile) {
    const newProfile = await upsertProfile(data.user.id, name, '👦');
    return { user: data.user, profile: newProfile };
  }
  return { user: data.user, profile };
}

function setActiveProfile(userId, profile) {
  sozleUser    = { id: userId };
  sozleProfile = profile;
  document.getElementById('sozleProfileBtn').textContent = profile.avatar + ' ' + profile.display_name;
  document.getElementById('sozleDropAvatar').textContent = profile.avatar;
  document.getElementById('sozleDropName').textContent   = profile.display_name;
  updateProfileStats();
  flushPendingGameResult();
}

function updateProfileStats() {
  if (!sozleProfile) return;
  const p       = sozleProfile;
  const played  = p.sozle_games_played || 0;
  const won     = p.sozle_games_won    || 0;
  const streak  = p.sozle_streak       || 0;
  const winPct  = played > 0 ? Math.round((won / played) * 100) : 0;
  document.getElementById('sozleStatPlayed').textContent = played;
  document.getElementById('sozleStatWin').textContent    = winPct + '%';
  document.getElementById('sozleStatStreak').textContent = '🔥 ' + streak;
}

// The increment used to happen client-side (read sozleProfile, add 1, write
// it back) which raced across tabs/devices and trusted the client's clock
// for "today"/"yesterday". record_sozle_game() does the read-modify-write
// atomically in Postgres under a row lock, keyed off current_date, so a
// duplicate call for the same day is a no-op and the client clock is
// irrelevant.
async function recordSozleGame(won) {
  if (!sozleUser || !sozleProfile) return;
  const { data, error } = await db.rpc('record_sozle_game', { p_won: won });
  if (error) { console.error(error); return; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return;
  Object.assign(sozleProfile, {
    sozle_games_played: row.sozle_games_played,
    sozle_games_won:    row.sozle_games_won,
    sozle_streak:       row.sozle_streak,
    sozle_last_played:  row.sozle_last_played
  });
  updateProfileStats();
}

function showSozleError(form, msg) {
  const el = document.getElementById(form === 'signup' ? 'sozleSignupErr' : 'sozleSigninErr');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function setSozleLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled  = loading;
  btn.textContent = loading ? '...' : (btnId === 'sozleBtnSignup' ? 'Hesab yarat' : 'Daxil ol');
}

function showAuthModal() {
  document.getElementById('sozleAuthOverlay').classList.remove('hidden');

  // showAuthModal() re-runs every time the modal opens (logged-out profile
  // button, save-progress prompt), so addEventListener here stacked a new
  // handler on the same buttons each time — .onclick overwrites instead of
  // accumulating, matching the pwd-toggle wiring right below.
  document.querySelectorAll('.sozle-avatar-opt').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.sozle-avatar-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAvatar = btn.dataset.avatar;
    };
  });

  document.querySelectorAll('.sozle-pwd-toggle').forEach(btn => {
    btn.onclick = () => {
      const input = document.getElementById(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁️';
      btn.setAttribute('aria-label', show ? 'Şifrəni gizlət' : 'Şifrəni göstər');
    };
  });

  document.getElementById('sozleTabSignup').onclick = () => {
    document.getElementById('sozleFormSignup').classList.remove('hidden');
    document.getElementById('sozleFormSignin').classList.add('hidden');
    document.getElementById('sozleTabSignup').classList.add('active');
    document.getElementById('sozleTabSignin').classList.remove('active');
  };
  document.getElementById('sozleTabSignin').onclick = () => {
    document.getElementById('sozleFormSignin').classList.remove('hidden');
    document.getElementById('sozleFormSignup').classList.add('hidden');
    document.getElementById('sozleTabSignin').classList.add('active');
    document.getElementById('sozleTabSignup').classList.remove('active');
  };

  const skip = () => document.getElementById('sozleAuthOverlay').classList.add('hidden');
  document.getElementById('sozleBtnSkip').onclick  = skip;
  document.getElementById('sozleBtnSkip2').onclick = skip;

  document.getElementById('sozleBtnSignup').onclick = async () => {
    const name    = document.getElementById('sozleSignupName').value.trim();
    const pwd     = document.getElementById('sozleSignupPwd').value;
    const confirm = document.getElementById('sozleSignupCfm').value;
    setSozleLoading('sozleBtnSignup', true);
    try {
      const { user, profile } = await doSignUp(name, selectedAvatar, pwd, confirm);
      setActiveProfile(user.id, profile);
      localStorage.setItem('sozle_seen_help', '1');
      document.getElementById('sozleAuthOverlay').classList.add('hidden');
    } catch (e) { showSozleError('signup', e.message); }
    finally { setSozleLoading('sozleBtnSignup', false); }
  };

  document.getElementById('sozleBtnSignin').onclick = async () => {
    const name = document.getElementById('sozleSigninName').value.trim();
    const pwd  = document.getElementById('sozleSigninPwd').value;
    setSozleLoading('sozleBtnSignin', true);
    try {
      const { user, profile } = await doSignIn(name, pwd);
      setActiveProfile(user.id, profile);
      document.getElementById('sozleAuthOverlay').classList.add('hidden');
    } catch (e) { showSozleError('signin', e.message); }
    finally { setSozleLoading('sozleBtnSignin', false); }
  };

  document.getElementById('sozleSigninPwd').onkeydown = e => {
    if (e.key === 'Enter') document.getElementById('sozleBtnSignin').click();
  };
}

// Profile dropdown toggle
document.getElementById('sozleProfileBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!sozleUser) { showAuthModal(); return; }
  document.getElementById('sozleDropdown').classList.toggle('hidden');
  updateProfileStats();
});

document.addEventListener('click', () => {
  document.getElementById('sozleDropdown').classList.add('hidden');
});
document.getElementById('sozleDropdown').addEventListener('click', e => e.stopPropagation());

document.getElementById('sozleSignOut').addEventListener('click', async () => {
  document.getElementById('sozleDropdown').classList.add('hidden');
  await db.auth.signOut();
  sozleUser = null; sozleProfile = null;
  document.getElementById('sozleProfileBtn').textContent = '👤';
});

// ── Word History ──────────────────────────────────────
// Word history used to be computed client-side with the same formula as
// the daily target — which meant devtools could read every past *and
// future* answer straight out of WORD_LIST. It's now fetched from the
// sozle-history edge function, which only reveals today's word once the
// caller has actually finished it.
async function showHistory() {
  const overlay = document.getElementById('sozleHistory');
  overlay.classList.remove('hidden');
  document.getElementById('histClose').onclick = () => overlay.classList.add('hidden');

  const months = ['Yan','Fev','Mar','Apr','May','İyn','İyl','Avq','Sen','Okt','Noy','Dek'];
  const body   = document.getElementById('histBody');
  body.innerHTML = '<div class="lb-loading">Yüklənir...</div>';

  let data;
  try {
    data = await callSozleFunction('sozle-history');
  } catch (e) {
    console.error('sozle-history failed:', e);
    body.innerHTML = '<div class="lb-loading">Xəta baş verdi.</div>';
    return;
  }
  if (!data || !data.days) { body.innerHTML = '<div class="lb-loading">Xəta baş verdi.</div>'; return; }

  const rows = data.days.map((d, i) => {
    const date = new Date(d.date + 'T00:00:00Z');
    const label = i === 0 ? 'Bu gün' : i === 1 ? 'Dünən' : `${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
    const display = d.word
      ? `<span class="hist-word">${d.word}</span>`
      : `<span class="hist-locked">🔒 Oyunu bitir</span>`;
    return `
      <div class="lb-row">
        <span class="hist-date">${label}</span>
        ${display}
      </div>`;
  });

  body.innerHTML = rows.join('');
}

// display_name is user-controlled (only .trim()'d at signup) and gets
// interpolated straight into loadLeaderboard's innerHTML — without this, a
// name like <img src=x onerror=...> runs for every visitor who opens the
// leaderboard. sozleDropName/sozleProfileBtn elsewhere use .textContent,
// which is inherently safe; the leaderboard's innerHTML call site needs
// this explicitly. (showHistory's word cells come from the curated
// word-list corpus, not user input, so they aren't part of this vector.)
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Leaderboard ───────────────────────────────────────
let lbCurrentTab = 'streak';

async function showLeaderboard() {
  document.getElementById('sozleLeaderboard').classList.remove('hidden');
  document.getElementById('lbClose').onclick = () =>
    document.getElementById('sozleLeaderboard').classList.add('hidden');
  await loadLeaderboard(lbCurrentTab);
}

function switchLbTab(tab) {
  lbCurrentTab = tab;
  document.getElementById('lbTabStreak').classList.toggle('active', tab === 'streak');
  document.getElementById('lbTabWins').classList.toggle('active', tab === 'wins');
  loadLeaderboard(tab);
}

// Routed through sozle-leaderboard (service-role, cached) instead of
// querying sozle_profiles directly with the anon key — this was the one
// read path in the app that bypassed the server-function layer everything
// else goes through, and depended on an RLS policy not visible in this
// codebase.
async function loadLeaderboard(tab) {
  const body = document.getElementById('lbBody');
  body.innerHTML = '<div class="lb-loading">Yüklənir...</div>';

  let res;
  try {
    res = await callSozleFunction('sozle-leaderboard', { tab });
  } catch (e) {
    console.error('sozle-leaderboard failed:', e);
    body.innerHTML = '<div class="lb-loading">Xəta baş verdi.</div>';
    return;
  }
  const data = res && res.data;
  if (!data) { body.innerHTML = '<div class="lb-loading">Xəta baş verdi.</div>'; return; }

  const currentName = sozleProfile?.display_name || null;

  body.innerHTML = data.map((p, i) => {
    const pct     = p.sozle_games_played > 0 ? Math.round((p.sozle_games_won / p.sozle_games_played) * 100) : 0;
    const isMe    = p.display_name === currentName;
    const medal   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const streak  = tab === 'streak' ? `<strong>🔥 ${p.sozle_streak}</strong>` : `🔥 ${p.sozle_streak}`;
    const wins    = tab === 'wins'   ? `<strong>⭐ ${p.sozle_games_won}</strong>` : `⭐ ${p.sozle_games_won}`;
    return `
      <div class="lb-row ${isMe ? 'lb-me' : ''}">
        <span class="lb-rank">${medal}</span>
        <span class="lb-avatar">${esc(p.avatar || '👤')}</span>
        <span class="lb-name">${esc(p.display_name)}</span>
        <span class="lb-stats">${streak} &nbsp; ${wins} &nbsp; <span class="lb-pct">${pct}%</span></span>
      </div>`;
  }).join('') || '<div class="lb-loading">Hələ heç kim yoxdur.</div>';
}

// Auto-login on page load
(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    const { data: profile } = await db.from('sozle_profiles').select('*').eq('id', session.user.id).single();
    if (profile) setActiveProfile(session.user.id, profile);
  }
  // Guests just play — auth prompt appears after first game
})();

// Renders an already-evaluated guess into a row immediately (no reveal
// animation) — used to redraw prior guesses on load, not for a live guess.
function renderCompletedRow(row, guess, result) {
  guess.split('').forEach((l, i) => {
    board[row][i] = l;
    const t = document.getElementById(`tile-${row}-${i}`);
    t.textContent = l;
    t.classList.add('filled', result[i]);
  });
  updateKeyStates(guess.split(''), result);
  submittedGuesses.add(guess);
}

// The board/tiles used to be lost on every refresh — nothing (client or
// server) remembered individual guesses, only the final finished/solved
// flags. sozle_daily_attempts.guesses now stores each {guess, result} the
// server evaluated, so this replays them into the grid and restores the
// reveal/lock state on load. Guests get nothing back here (anonymous play
// was never server-tracked, same as before).
async function restoreDailyStatus() {
  if (mode !== 'daily') { boardReady = true; return; }
  boardReady = false; // block input for the duration of this fetch — see initGame()
  // Reset first, before the fetch: without this, dailyCompleted/dailyWord
  // from a previous day (still sitting in memory if the tab was left open
  // overnight, or from switching modes and back) stuck around as "true"/
  // stale even on a fresh day with zero guesses, since the early return
  // below never touched them otherwise.
  dailyCompleted = false;
  dailyWord = "";
  updateRevealBtn();
  try {
    const data = await callSozleFunction('sozle-status');
    if (!data || !data.guesses || data.guesses.length === 0) return;
    data.guesses.forEach((g, i) => renderCompletedRow(i, g.guess, g.result));
    currentRow = data.guesses.length;
    renderKeyboard();
    if (data.finished) {
      gameOver = true;
      dailyCompleted = true;
      if (data.word) dailyWord = data.word;
      updateRevealBtn();
    }
  } catch (e) {
    // Best-effort by design (a failed check just leaves the board empty
    // instead of blocking the page), but that shouldn't mean invisible in
    // production — log it so a spike in these is actually noticeable.
    console.error('sozle-status failed:', e);
  }
  finally {
    // Always re-zero currentCol: if the restore replayed N rows, row N is
    // the fresh one the player types into next, regardless of whatever
    // column a race with live typing left it at before this resolved.
    currentCol = 0;
    boardReady = true;
  }
}
restoreDailyStatus();
