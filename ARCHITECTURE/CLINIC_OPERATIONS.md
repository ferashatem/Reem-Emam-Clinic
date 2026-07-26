# نظام تشغيل العيادة — الحجوزات والدفع والحسابات

الملف ده بيوصف الجزء التشغيلي اللي بتستخدمه الشريكتين والأسيستانت يوميًا.
(ملفات `ARCHITECTURE/*.md` القديمة بتوصف نسخة Next.js قديمة — التطبيق الحالي Vite + React Router.)

## الأدوار

| الدور | مين | بيشوف إيه |
|---|---|---|
| `super_admin` | المدير العام | كل حاجة + إدارة الفريق والخدمات والإعدادات |
| `admin` | ريم ورانيا (الشريكتين) | كل الحجوزات، ملفات كل المرضى، الحسابات والجرد |
| `staff` | الأسيستانت | شاشتين بس: **الحجوزات** و **الدفع** |
| `client` | العميلة | الحجز من الموقع ومتابعة جلساتها |

الشريكتين بيشوفوا نفس البيانات بالظبط — مفيش فلترة بـ `admin_id` في ملف المريض
ولا في تقارير الجلسات ولا في الحسابات.

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

- كل خدمة ليها `price_per_pulse` **اختياري**.
- لو متملّي: الإجمالي = `pulses × price_per_pulse` وبيتحسب أوتوماتيك في فورم الحجز.
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

## ملاحظة أمنية معروفة

قاعدة قراءة `reservations` فيها `isAuth()` في الآخر — أي مستخدم مسجّل يقدر
يقرا كل الحجوزات. ده موجود من الأصل عشان صفحة الحجز في الموقع بتحتاج تشوف
المواعيد المحجوزة. الحل الصح إن `getAvailableTimeSlots` تتنقل لـ Cloud Function
(أو كوليكشن `availability` منفصل فيها المواعيد بس من غير أسماء) وبعدين تتشال
`isAuth()` من قاعدة القراءة.
