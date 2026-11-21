# मासिक दौरा दैनंदिनी व्यवस्थापन प्रणाली
## प्राथमिक आरोग्य केंद्र भादा — आरोग्य सहाय्यक श्री. हिप्परगेकर जी. एस.

मासिक वारनिहाय आरोग्य सेवा सत्र कार्यक्रम आणि स्वयंचलित मासिक दौरा दैनंदिनी व्यवस्थापनासाठी तयार केलेले पूर्ण-स्टॅक (Full-Stack) मराठी वेब ॲप्लिकेशन.

या प्रणालीमध्ये **Google Apps Script Web App (`apps-script/Code.gs`)** हा Backend API म्हणून आणि आपल्या वैयक्तिक Google Drive (`phbhada@gmail.com`) मधील **एकमेव Google Spreadsheet (`PHC_Bhada_Monthly_Tour_Diary_DB`)** हाच मुख्य व कायमस्वरूपी डेटाबेस (Primary & Permanent Database) आहे.

---

## Google Apps Script + Single Spreadsheet रचना

- **Backend API**: वैयक्तिक `phbhada@gmail.com` खात्यात Deploy केलेले Google Apps Script Web App (`Execute as: Me`, `Who has access: Anyone`).
- **सुरक्षा**: प्रत्येक विनंती `APP_SECRET_TOKEN` (Apps Script Script Properties) व `GOOGLE_APPS_SCRIPT_SECRET` (Server Environment Variable) द्वारे प्रमाणित होते. Secret Token कधीही Frontend कोडमध्ये दिसत नाही.
- **एकच Spreadsheet**: आपल्या Google Drive मध्ये `PHC_Bhada_Monthly_Tour_Diary_DB` या नावाचे **फक्त एकच** Spreadsheet तयार/वापरले जाते (कधीही Duplicate Spreadsheets तयार होत नाहीत).
- त्याच Spreadsheet मध्ये खालील सर्व **१० Master Tabs** आपोआप तयार व व्यवस्थापित होतात:
  1. `Employee_Master`
  2. `Subcenter_Master`
  3. `Village_Master`
  4. `Weekly_Schedule_Master`
  5. `Government_Holiday_Master`
  6. `Leave_Management`
  7. `Special_Event_Master`
  8. `Monthly_Diary`
  9. `Diary_Change_History`
  10. `Application_Settings`
- याशिवाय, प्रत्येक महिन्याची दौरा दैनंदिनी तयार होताच त्याच Spreadsheet मध्ये स्वतंत्र टॅब (`April_2026`, `May_2026`, `June_2026`, ...) आपोआप तयार किंवा अपडेट होतो.

---

## फोल्डर रचना (Project Structure)

```text
├── apps-script/
│   └── Code.gs                       # Google Apps Script Web App Backend (थेट Google Sheets CRUD व Validation)
├── server.ts                         # Express सर्व्हर व REST API Proxy (Apps Script कडे सुरक्षित Server-to-Server कॉल)
├── src/
│   ├── server/
│   │   ├── appsScriptClient.ts       # Google Apps Script API Client व Marathi Error Handling
│   │   └── sheetsConfig.ts           # Sheet नावे, Column Headers व Default डेटा
│   ├── shared/
│   │   ├── types.ts                  # TypeScript डेटा मॉडेल्स
│   │   ├── marathi.ts                # मराठी महिने, वार, DD-MM-YYYY व आर्थिक वर्ष Helpers
│   │   └── diaryEngine.ts            # स्वयंचलित दौरा दैनंदिनी निर्मिती इंजिन (नियम १ ते ५)
│   ├── services/
│   │   └── api.ts                    # Frontend API Client
│   ├── utils/
│   │   └── exportUtils.ts            # Excel (.xlsx) व JSON Backup Export
│   ├── components/                   # सर्व ११ मराठी डॅशबोर्ड, फॉर्म व अहवाल Modules
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                     # मराठी फॉन्ट व A4 Print CSS
├── .env.example                      # Backend Environment Variables नमुना
└── package.json
```

---

## सेटअप व Deployment सूचना

1. **Google Apps Script Deploy करा (`phbhada@gmail.com`)**:
   - https://script.google.com उघडून नवीन Project तयार करा (`PHC_Bhada_Monthly_Tour_Diary_API`).
   - `apps-script/Code.gs` मधील संपूर्ण कोड पेस्ट करून Save करा.
   - **Project Settings → Script Properties** मध्ये `APP_SECRET_TOKEN` की जोडा आणि मजबूत गुप्त पासकोड (Secret Token) सेट करा.
   - **Deploy → New deployment → Web app** निवडा:
     - **Execute as**: `Me (phbhada@gmail.com)`
     - **Who has access**: `Anyone`
   - Deploy करून मिळालेली `/exec` **Web App URL** कॉपी करा.
2. **AI Studio Secrets / Environment Variables सेट करा**:
   - `GOOGLE_APPS_SCRIPT_URL` — Deploy केलेली Apps Script `/exec` URL
   - `GOOGLE_APPS_SCRIPT_SECRET` — वरील `APP_SECRET_TOKEN` शी हुबेहूब जुळणारे मूल्य
3. **डेव्हलपमेंट सर्व्हर सुरू करा**:
   ```bash
   npm install
   npm run dev
   ```
4. **Production Build आणि Run**:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```
