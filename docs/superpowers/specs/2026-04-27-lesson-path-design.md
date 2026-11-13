# Duolingo-style Lesson Path — Dizayn Sənədi
**Tarix:** 2026-04-27  
**Layihə:** İngiliscə Öyrənmə Platforması

---

## 1. Xülasə

İngilis dili öyrənmə platforması üçün Duolingo-ilhamli, node-əsaslı dərs yolu. Tələbə ardıcıl nodları keçərək irəliləyir: hər nod mətn dərsi + quiz-dən ibarətdir. 5 can sistemi motivasiya yaradır. Mavi rəng sxemi. Giriş sistemi yoxdur (hələlik localStorage).

---

## 2. Fayl Strukturu

```
ingilisce platforma/
├── ingilisce.html       # Tək səhifə
├── ingilisce.css        # Mavi tema, node stilləri
├── ingilisce.js         # UI məntiqi + localStorage
└── curriculum.json      # Bütün dərslər və suallar
```

---

## 3. Kurikulum Strukturu

4 əsas bölmə, hər birinin altında nodlar:

| Bölmə | Nodlar |
|---|---|
| FONETİKA | Səs-hərf sistemi, Oxunuş qaydaları, Saitlər, Samitlər, Heca və Vurğu |
| LEKSİKOLOGİYA | Sözün mənası, Söz qrupları, Sözlərin quruluşu, Phrasal Verbs, Word Formation |
| MORFOLOGİYA | İsim, Artikl, Sifət, Say, Əvəzlik, Feil, Zərf/Ədat/Sözönü |
| SİNTAKSİS | Collocations, Sadə cümlə, Xüsusi konstruksiyalar, Mürəkkəb cümlə, Budaq cümlələr, Conditionals, Direct/Indirect Speech |

---

## 4. curriculum.json Formatı

```json
{
  "sections": [
    {
      "id": "fonetika",
      "title": "FONETİKA (Phonetics)",
      "nodes": [
        {
          "id": "fonetika-1",
          "title": "Səs və hərf sistemi",
          "lesson": "Dərs mətni burda...",
          "questions": [
            {
              "type": "multiple_choice",
              "question": "Sual?",
              "options": ["A", "B", "C", "D"],
              "answer": "A"
            },
            {
              "type": "fill_blank",
              "question": "İngilis dilində ___ hərf var.",
              "answer": "26"
            },
            {
              "type": "true_false",
              "question": "İddia doğrudur.",
              "answer": false
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 5. localStorage Strukturu

```json
{
  "completedNodes": ["fonetika-1", "fonetika-2"],
  "lives": 5,
  "currentQuizNode": null
}
```

- `completedNodes`: tamamlanmış node ID-ləri
- `lives`: cari can sayı (0-5)
- `currentQuizNode`: quiz yarıda qalmışsa node ID-si (null = yoxdur)

---

## 6. Node Vəziyyətləri

| Vəziyyət | Görünüş | Davranış |
|---|---|---|
| Kilidli | Boz, 🔒 ikonu | Klik işləmir |
| Aktiv | Mavi, parlaq | Klik → Dərs modalı |
| Tamamlanmış | Mavi + ✅ | Klik → Dərsi yenidən oxumaq olar (quiz yoxdur, node ✅ qalır) |

**Qayda:** İlk node həmişə aktivdir. Bir node tamamlandıqda növbəti aktiv olur. Tamamlanmış nodlara klik ediləndə yalnız dərs mətni göstərilir — "Bitirdim" düyməsi olmur, quiz başlamır, node vəziyyəti dəyişmir.

---

## 7. Dərs Axışı

```
1. Tələbə aktiv nodun üzərinə basır
2. Dərs modalı açılır (mətn + "Bitirdim" düyməsi)
3. "Bitirdim" basıldıqda quiz başlayır
4. Suallar qarışıq sıra ilə göstərilir
5a. Bütün suallar keçildi → Node ✅, növbəti node açılır
5b. 5 can bitdi → Lives: 5 sıfırlanır, dərs modalı yenidən açılır
```

---

## 8. Quiz Məntiqi

- **Sual tipləri:** Multiple choice, Fill in the blank, True/False
- **Sual sayı:** JSON-da yazılan qədər (tövsiyə: 5-10)
- **Sıra:** Hər dəfə shuffle olunur
- **Yanlış cavab:** 1 can azalır + qısa kırmızı animasiya
- **Doğru cavab:** Qısa mavi animasiya + növbəti sual
- **Can bitdikdə:** Modal bağlanır, node sıfırlanır (lives: 5), dərs yenidən açılır
- **Quiz bağlandıqda (✕):** Progress saxlanmır, can azalmır

---

## 9. UI Dizaynı

### Rəng Sxemi
- **Əsas:** `#1a73e8` (mavi)
- **Aktiv node:** `#1a73e8` parlaq mavi
- **Tamamlanmış:** `#0d47a1` tünd mavi + checkmark
- **Kilidli:** `#9e9e9e` boz
- **Can:** ❤️ dolu / 🤍 boş

### Layout
- Mərkəzdə şaquli yol (path)
- Bölmə başlıqları yolun üstündə
- Nodlar arasında bağlayan xətt
- Modal üst-üstə açılır (overlay)

---

## 10. Gələcək Backend İnteqrasiyası

localStorage açarları backend API-yə uyğun dizayn edilib:
- `completedNodes` → `GET/POST /api/progress`
- `lives` → `GET/POST /api/lives`

Gələcəkdə localStorage çağırışlarını API çağırışları ilə əvəz etmək kifayət edəcək.

---

## 11. Həll olunmamış məsələlər

- Hər nodda minimum neçə sual olmalıdır? (Tövsiyə: 5)
- Can gündəlik yenilənirmi, yoxsa yalnız sıfırlamada? (Hələlik: yalnız sıfırlamada)
