# نظام تشغيل العيادة — الحجوزات والدفع والحسابات

الملف ده بيوصف الجزء التشغيلي اللي بتستخدمه الشريكتين والأسيستانت يوميًا.
(ملفات `ARCHITECTURE/*.md` القديمة بتوصف نسخة Next.js قديمة — التطبيق الحالي Vite + React Router.)

## الأدوار

| الدور | مين | بيشوف إيه |
|---|---|---|
| `super_admin` | المدير العام | كل حاجة + إدارة الفريق والخدمات والإعدادات |
| `admin` | ريم ورانيا (الشريكتين) | كل الحجوزات، ملفات كل المرضى، الحسابات والجرد |
| `staff` | الأسيستانت | شاشتين بس: **الحجوزات** و **الدفع** |

**العميلات مالهمش حسابات خالص** — مفيش تسجيل دخول ولا OTP ولا بورتال.
الزائرة بتحجز من الموقع على طول، والطلب بيوصل للأسيستانت تأكده.

الشريكتين بيشوفوا نفس البيانات بالظبط — مفيش فلترة بـ `admin_id` في ملف المريض
ولا في تقارير الجلسات ولا في الحسابات.

## الحجز من الموقع (من غير تسجيل)

```
الزائرة تملّي الفورم (اسم، تليفون، تاريخ، وقت، ملاحظات)
   ↓
reservation جديد:  status='pending'  booked_by='client'  client_id=null
   ↓
يظهر للأسيستانت في تاب «طلبات من الموقع»
   ↓
تضغط «تأكيد»  →  النظام يدوّر على ملف بنفس رقم التليفون
   ├── لقاه   → يربط الحجز بالملف القديم (مفيش تكرار للمرضى)
   └── ملقاش  → يفتح ملف مريضة جديد ويربطه
   ↓
status='confirmed' + client_id متملّي → الحجز بقى في السجل عادي
```

الطلب اللي لسه متأكدش **مش** بيظهر في قائمة المرضى ولا في حسابات المستحقات —
لسه مش مريضة.

## المسارات

الشاشات المشتركة (`src/pages/shared/`) متركّبة تحت `/admin` و `/super-admin`:

```
/staff/reservations      الحجوزات        (نفس صفحة الشريكتين)
/staff/payments          الدفع والتحصيلات

/admin/dashboard         الرئيسية
/admin/reservations      الحجوزات
/admin/patients          قائمة المرضى
/admin/patients/:id      ملف المريض الكامل
/admin/accounting        الحسابات والجرد الشهري
```

## التسعير بالنبضة

- السوبر أدمن بيكتب للخدمة `price_per_pulse` أو `price` (سعر ثابت) — واحد منهم على الأقل.
- لو `price_per_pulse` متملّي: وقت الحجز الأسيستانت بتكتب عدد النبضات،
  والإجمالي = `pulses × price_per_pulse` بيتحسب أوتوماتيك.
- لو فاضي: الخدمة بسعر ثابت (`price`) والنبضات بتتسجل للتوثيق الطبي بس.
- في الحالتين الأسيستانت تقدر تعدّل `price_at_booking` يدوي (خصم، عرض، باكدچ).

## دورة الفلوس

```
حجز (price_at_booking)
   ↓
العميلة تدفع → /staff/payments
   ↓
createPayment()  ← ترانزاكشن واحدة
   ├── بتكتب doc في payments
   └── بتحدّث الحجز: paid_amount + payment_status (unpaid | partial | paid)
   ↓
الحسابات: إيراد الشهر = مجموع payments بتاعة الشهر (فلوس داخلة فعلاً، مش فواتير)
```

`softDeletePayment` بترجّع المبلغ من `paid_amount` بنفس الترانزاكشن، فالأرقام
عمرها ما تفرق عن بعض.

## الجرد الشهري

```
صافي الربح = مجموع التحصيلات − مجموع المصاريف   (لنفس الشهر)
نصيب كل شريكة = صافي الربح ÷ عدد الشريكات
```

- أسماء الشريكات في `settings/clinic.partners` (الافتراضي: ريم، رانيا) وبتتظبط من صفحة الإعدادات.
- زرار «إقفال الشهر» بيحفظ سناب-شوت في `monthly_closings/{YYYY-MM}` — الـ doc id هو
  الشهر نفسه، فالإقفال مرتين بيحدّث نفس المستند مش بيعمل نسخة تانية.

## الكوليكشنز الجديدة

### `/expenses/{id}`
| الحقل | النوع | ملاحظات |
|---|---|---|
| `title` | string | مثال: فاتورة كهربا يوليو |
| `category` | string | `electricity` \| `water` \| `rent` \| `salaries` \| `supplies` \| `maintenance` \| `marketing` \| `other` |
| `amount` | number | لازم > 0 (متحقّق منه في الـ rules) |
| `date` | string | `YYYY-MM-DD` |
| `month` | string | `YYYY-MM` — مشتق من `date` عشان الفلترة |
| `created_by` / `created_by_name` | string | مين سجّله |
| `deleted_at` | timestamp \| null | soft delete |

### `/monthly_closings/{YYYY-MM}`
| الحقل | النوع |
|---|---|
| `month` | string `YYYY-MM` |
| `total_revenue` / `total_expenses` / `net_profit` | number |
| `partners` | `[{ name, amount }]` |
| `sessions_count` / `payments_count` | number |
| `closed_by` / `closed_by_name` / `closed_at` | — |

### حقول اتزادت على الموجود
- `reservations`: `pulses`, `price_per_pulse`, `paid_amount`, `payment_status`,
  `client_name`, `client_phone`
- `payments`: `month`
- `services`: `price_per_pulse`
- `settings/clinic`: `partners: string[]`

## ملاحظات أمنية

**القراءة اتقفلت.** بعد شيل بورتال العميلات، `reservations` و `clients` بقت
`isTeam()` بس — مفيش أي حد بره الفريق يقدر يقرا أسماء أو أرقام المرضى.

**الكتابة العامة.** فورم الحجز بيكتب من غير تسجيل دخول، فالقاعدة بتتحقق من
الشكل بدقة: `status='pending'`، `booked_by='client'`، `client_id=null`،
`admin_id=null`، `paid_amount=0`، وحدود لطول الاسم/الرقم/الملاحظات. يعني
مستحيل حد من بره يعمل حجز مؤكد أو يلزّق نفسه بملف مريضة موجود.

الباقي إن حد يبعت طلبات وهمية كتير (سبام). المتاح إنه يزحم تاب «طلبات من الموقع»
بس ومش بيوصل لأي داتا. لو حصل، الحل هو تفعيل
[Firebase App Check](https://firebase.google.com/docs/app-check) على المشروع —
مش محتاج أي تغيير في الكود، بس تفعيل من الكونسول + سطر في `firebase.ts`.
