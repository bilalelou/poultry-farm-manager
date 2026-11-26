const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'documents', 'cooperative');
fs.mkdirSync(targetDir, { recursive: true });

function wrapWordDoc(title, content) {
  return `\ufeff<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${title}</title>
  <style>
    body { font-family: 'Arial', 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: right; padding: 25px; line-height: 1.6; color: #0f172a; }
    h1, h2, h3 { color: #1e3a8a; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th, td { border: 1px solid #64748b; padding: 8px 12px; text-align: right; font-size: 13px; }
    th { background-color: #f1f5f9; font-weight: bold; }
    .header-box { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; }
    .signature-box { margin-top: 30px; border: 1px dashed #cbd5e1; padding: 15px; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="Section1">
    ${content}
  </div>
</body>
</html>`;
}

// 1. محضر الجمع العام التأسيسي
const doc1Content = `
<div class="header-box">
  <p style="font-size: 13px; color: #475569; margin: 0;">المملكة المغربية — ملف تأسيس تعاونية وفق القانون رقم 112.12</p>
  <h1 style="font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 8px 0 4px 0;">محضر الجمع العام التأسيسي</h1>
  <p style="font-size: 16px; font-weight: bold; color: #0284c7; margin: 0;">تعاونية: مراعي الوادي</p>
</div>

<p style="text-align: justify; font-size: 14px; margin-bottom: 14px;">
  في يوم <strong>الخميس 26 نونبر 2026</strong> على الساعة <strong>العاشرة صباحاً (10:00)</strong>، انعقد بمقر <strong>[العنوان الكامل للمقر الاجتماعي]</strong>، الجمع العام التأسيسي لتعاونية <strong>مراعي الوادي</strong>، وذلك بحضور الأعضاء المؤسسين الموقعة أسماؤهم أسفله.
</p>

<h3 style="font-size: 16px; color: #1e3a8a; border-right: 4px solid #1e3a8a; padding-right: 8px; margin: 16px 0 8px 0;">جدول الأعمال:</h3>
<ol style="font-size: 14px; margin: 0 20px 14px 0; padding: 0;">
  <li>قراءة ومناقشة مشروع النظام الأساسي للتعاونية والمصادقة عليه.</li>
  <li>تحديد رأس المال المكتتب به والمصادقة على لائحة الأعضاء المؤسسين المكتتبين.</li>
  <li>تعيين مسير التعاونية وتحديد مدة انتدابه وصلاحياته.</li>
  <li>تفويض الصلاحيات للقيام بالإجراءات القانونية والإدارية للتأسيس والتسجيل.</li>
</ol>

<h3 style="font-size: 16px; color: #1e3a8a; border-right: 4px solid #1e3a8a; padding-right: 8px; margin: 16px 0 8px 0;">وقائع الجمع العام والقرارات المتخذة:</h3>
<p style="text-align: justify; font-size: 14px; margin-bottom: 8px;">
  بعد افتتاح الجلسة والترحيب بالحاضرين، تم التداول في النقط المدرجة بجدول الأعمال، واتخذ الجمع العام التأسيسي القرارات التالية بالإجماع:
</p>
<ul style="font-size: 14px; margin: 0 20px 14px 0; padding: 0; line-height: 1.8;">
  <li><strong>القرار الأول:</strong> المصادقة على النظام الأساسي لتعاونية <strong>مراعي الوادي</strong> وفق مقتضيات القانون رقم 112.12 المتعلق بالتعاونيات، مع تحديد مقرها الاجتماعي بـ <strong>[العنوان الكامل للمقر الاجتماعي]</strong>.</li>
  <li><strong>القرار الثاني:</strong> المصادقة على لائحة الأعضاء المؤسسين المكتتبين في رأس مال التعاونية المحدد في مبلغ <strong>1000 درهم (ألف درهم)</strong>، والمقسم إلى <strong>10 حصص</strong> اجتماعية بقيمة <strong>100 درهم</strong> لكل حصة.</li>
  <li><strong>القرار الثالث:</strong> تعيين السيد <strong>بلال الوادي</strong>، الحامل للبطاقة الوطنية رقم <strong>CD916618</strong>، مسيراً وحيداً للتعاونية لمدة <strong>[3 سنوات]</strong>، مع تخويله جميع الصلاحيات القانونية لتسيير شؤون التعاونية وتمثيلها.</li>
  <li><strong>القرار الرابع:</strong> تفويض مسير التعاونية السيد <strong>بلال الوادي</strong>، الحامل للبطاقة الوطنية رقم <strong>CD916618</strong>، للقيام بجميع الإجراءات اللازمة لفتح الحساب البنكي المجمد، وإيداع ملف التأسيس لدى السلطة المحلية، وتسجيل التعاونية بالسجل المحلي للتعاونيات بالمحكمة الابتدائية.</li>
</ul>

<p style="font-size: 14px; margin-top: 10px;">ورفعت الجلسة على الساعة الثانية عشرة والنصف زوالاً (<strong>12:30</strong>) من نفس اليوم.</p>

<h3 style="font-size: 15px; color: #1e3a8a; margin: 18px 0 8px 0;">توقيعات الأعضاء المؤسسين:</h3>
<table>
  <thead>
    <tr>
      <th style="width: 40px; text-align: center;">ر.ت</th>
      <th>الاسم الكامل</th>
      <th style="width: 120px; text-align: center;">رقم البطاقة (CIN)</th>
      <th style="width: 120px; text-align: center;">الصفة</th>
      <th style="width: 150px; text-align: center;">التوقيع</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align: center;">1</td>
      <td><strong>بلال الوادي</strong></td>
      <td style="text-align: center;">CD916618</td>
      <td style="text-align: center;">مسير / مؤسس</td>
      <td></td>
    </tr>
    <tr>
      <td style="text-align: center;">2</td>
      <td>[الاسم الكامل للعضو الثاني]</td>
      <td style="text-align: center;">[CIN 2]</td>
      <td style="text-align: center;">مؤسس</td>
      <td></td>
    </tr>
    <tr>
      <td style="text-align: center;">3</td>
      <td>[الاسم الكامل للعضو الثالث]</td>
      <td style="text-align: center;">[CIN 3]</td>
      <td style="text-align: center;">مؤسس</td>
      <td></td>
    </tr>
    <tr>
      <td style="text-align: center;">4</td>
      <td>[الاسم الكامل للعضو الرابع]</td>
      <td style="text-align: center;">[CIN 4]</td>
      <td style="text-align: center;">مؤسس</td>
      <td></td>
    </tr>
    <tr>
      <td style="text-align: center;">5</td>
      <td>[الاسم الكامل للعضو الخامس]</td>
      <td style="text-align: center;">[CIN 5]</td>
      <td style="text-align: center;">مؤسس</td>
      <td></td>
    </tr>
  </tbody>
</table>

<div style="margin-top: 25px; display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
  <span>حرر بـ [المكان] في 26 نونبر 2026</span>
  <span>توقيع مسير التعاونية (مصادق عليه)</span>
</div>
`;

// 2. النظام الأساسي
const doc2Content = `
<div class="header-box">
  <p style="font-size: 13px; color: #475569; margin: 0;">المملكة المغربية — وفق مقتضيات القانون رقم 112.12 المتعلق بالتعاونيات</p>
  <h1 style="font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 8px 0 4px 0;">النظام الأساسي للتعاونية</h1>
  <p style="font-size: 16px; font-weight: bold; color: #0284c7; margin: 0;">تعاونية: مراعي الوادي</p>
</div>

<h3>الباب الأول: التأسيس، التسمية، المقر، المدة، والغرض</h3>
<p><strong>المادة 1 (التأسيس والتسمية):</strong> تؤسس بين الموقعين على هذا النظام الأساسي والمنخرطين لاحقاً، تعاونية خاضعة لمقتضيات القانون رقم 112.12 المتعلق بالتعاونيات، تحمل تسمية: <strong>تعاونية مراعي الوادي</strong>.</p>
<p><strong>المادة 2 (المقر الاجتماعي):</strong> يحدد المقر الاجتماعي للتعاونية بـ: <strong>[العنوان الكامل للمقر، الجماعة، الإقليم]</strong>. ويمكن نقله إلى أي مكان آخر بقرار يتخذه الجمع العام.</p>
<p><strong>المادة 3 (المدة):</strong> حددت مدة التعاونية في <strong>99 سنة</strong> تبتدئ من تاريخ تسجيلها في السجل المحلي للتعاونيات، ما لم يتم حلها قبل الأوان أو تمديدها وفق القانون.</p>
<p><strong>المادة 4 (الغرض والنشاط):</strong> تهدف التعاونية إلى مزاولة الأنشطة الفلاحية التالية:</p>
<ul>
  <li><strong>الغرض الرئيسي:</strong> تربية الدواجن.</li>
  <li><strong>الأنشطة الأخرى:</strong> تربية المواشي، إنتاج الأعلاف البديلة وتثمينها، وتسويق المنتوجات الفلاحية.</li>
  <li>القيام بجميع العمليات التجارية والمالية المرتبطة بشكل مباشر أو غير مباشر بغرضها الاجتماعي.</li>
</ul>

<h3>الباب الثاني: رأس المال والحصص الاجتماعية</h3>
<p><strong>المادة 5 (رأس المال):</strong> يحدد رأس المال المكتتب به عند التأسيس في مبلغ <strong>1000 درهم (ألف درهم)</strong>، مقسم إلى <strong>10 حصص</strong> اجتماعية، قيمة كل حصة <strong>100 درهم</strong>.</p>
<p><strong>المادة 6 (تحرير الحصص):</strong> يلتزم كل عضو بتحرير ربع قيمة الحصص المكتتب بها على الأقل عند التأسيس، ويتم تحرير الباقي داخل أجل لا يتعدى ثلاث سنوات من تاريخ التسجيل.</p>

<h3>الباب الثالث: العضوية</h3>
<p><strong>المادة 7 (شروط الانخراط):</strong> يقبل عضواً في التعاونية كل شخص ذاتي أو اعتباري تتوفر فيه الشروط القانونية ويمارس نشاطاً يدخل في غرض التعاونية، بعد موافقة المسير والجمع العام.</p>
<p><strong>المادة 8 (الانسحاب والفصل):</strong> لكل عضو الحق في الانسحاب من التعاونية بتوجيه إشعار كتابي، كما يمكن فصل أي عضو يخل بالتزاماته بقرار معلل من الجمع العام.</p>

<h3>الباب الرابع: التسيير والجموع العامة</h3>
<p><strong>المادة 9 (الجمع العام):</strong> يتكون الجمع العام من جميع الأعضاء، ولكل عضو صوت واحد مهما كان عدد حصصه. ينعقد الجمع العام العادي مرة في السنة على الأقل خلال الستة أشهر الموالية لاختتام السنة المالية.</p>
<p><strong>المادة 10 (التسيير):</strong> يسير التعاونية <strong>مسير واحد</strong> يعينه الجمع العام لمدة <strong>[3 سنوات]</strong>، وذلك طبقاً لمقتضيات القانون رقم 112.12 المتعلق بالتعاونيات، ويتمتع بكامل الصلاحيات القانونية لإدارة شؤون التعاونية وتمثيلها أمام الإدارات والمؤسسات البنكية والقضائية.</p>

<h3>الباب الخامس: السنة المالية، توزيع الفائض، والحل</h3>
<p><strong>المادة 11 (السنة المالية):</strong> تبتدئ السنة المالية في فاتح يناير وتنتهي في 31 دجنبر من كل سنة. واستثناءً، تبتدئ السنة الأولى من تاريخ التسجيل بالسجل المحلي للتعاونيات.</p>
<p><strong>المادة 12 (توزيع الفائض):</strong> يخصص <strong>10% على الأقل</strong> من الفائض الصافي لتكوين الاحتياطي القانوني، ويوزع الباقي وفق مقتضيات القانون رقم 112.12 وقرارات الجمع العام.</p>
<p><strong>المادة 13 (الحل والتصفية):</strong> في حالة حل التعاونية، يؤول صافي الأصول بعد تصفية الديون واسترجاع الأعضاء لقيمة حصصهم إلى تعاونية أخرى أو اتحاد تعاونيات أو مكتب تنمية التعاون.</p>

<p style="font-weight: bold; margin-top: 15px;">حرر بـ [المكان] في 26 نونبر 2026</p>

<h3>توقيعات جميع الأعضاء المؤسسين (مصادق عليها):</h3>
<table>
  <thead>
    <tr>
      <th style="width: 40px; text-align: center;">ر.ت</th>
      <th>الاسم الكامل</th>
      <th style="width: 140px; text-align: center;">رقم البطاقة (CIN)</th>
      <th style="width: 160px; text-align: center;">التوقيع</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="text-align: center;">1</td><td>بلال الوادي</td><td style="text-align: center;">CD916618</td><td></td></tr>
    <tr><td style="text-align: center;">2</td><td>[الاسم الكامل للعضو الثاني]</td><td style="text-align: center;">[CIN 2]</td><td></td></tr>
    <tr><td style="text-align: center;">3</td><td>[الاسم الكامل للعضو الثالث]</td><td style="text-align: center;">[CIN 3]</td><td></td></tr>
    <tr><td style="text-align: center;">4</td><td>[الاسم الكامل للعضو الرابع]</td><td style="text-align: center;">[CIN 4]</td><td></td></tr>
    <tr><td style="text-align: center;">5</td><td>[الاسم الكامل للعضو الخامس]</td><td style="text-align: center;">[CIN 5]</td><td></td></tr>
  </tbody>
</table>
`;

// 3. لائحة المؤسسين والمكتتبين
const doc3Content = `
<div class="header-box">
  <p style="font-size: 13px; color: #475569; margin: 0;">المملكة المغربية — ملف تأسيس تعاونية وفق القانون رقم 112.12</p>
  <h1 style="font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 8px 0 4px 0;">لائحة الأعضاء المؤسسين المكتتبين في رأس المال</h1>
  <p style="font-size: 16px; font-weight: bold; color: #0284c7; margin: 0;">تعاونية: مراعي الوادي</p>
</div>

<div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 15px; margin-bottom: 15px; font-size: 14px; font-weight: bold;">
  رأس المال المكتتب به: 1000 درهم | عدد الحصص: 10 حصص | القيمة الاسمية للحصة: 100 درهم
</div>

<table>
  <thead>
    <tr>
      <th style="width: 35px; text-align: center;">ر.ت</th>
      <th>الاسم الكامل</th>
      <th style="width: 100px; text-align: center;">رقم البطاقة (CIN)</th>
      <th>العنوان الشخصي</th>
      <th style="width: 50px; text-align: center;">عدد الحصص</th>
      <th style="width: 80px; text-align: center;">المكتتب (درهم)</th>
      <th style="width: 80px; text-align: center;">المحرر (درهم)</th>
      <th style="width: 110px; text-align: center;">التوقيع</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="text-align: center;">1</td><td>بلال الوادي</td><td style="text-align: center;">CD916618</td><td>[العنوان الشخصي]</td><td style="text-align: center;">2</td><td style="text-align: center;">200</td><td style="text-align: center;">200</td><td></td></tr>
    <tr><td style="text-align: center;">2</td><td>[الاسم الكامل للعضو الثاني]</td><td style="text-align: center;">[CIN 2]</td><td>[العنوان الشخصي]</td><td style="text-align: center;">2</td><td style="text-align: center;">200</td><td style="text-align: center;">200</td><td></td></tr>
    <tr><td style="text-align: center;">3</td><td>[الاسم الكامل للعضو الثالث]</td><td style="text-align: center;">[CIN 3]</td><td>[العنوان الشخصي]</td><td style="text-align: center;">2</td><td style="text-align: center;">200</td><td style="text-align: center;">200</td><td></td></tr>
    <tr><td style="text-align: center;">4</td><td>[الاسم الكامل للعضو الرابع]</td><td style="text-align: center;">[CIN 4]</td><td>[العنوان الشخصي]</td><td style="text-align: center;">2</td><td style="text-align: center;">200</td><td style="text-align: center;">200</td><td></td></tr>
    <tr><td style="text-align: center;">5</td><td>[الاسم الكامل للعضو الخامس]</td><td style="text-align: center;">[CIN 5]</td><td>[العنوان الشخصي]</td><td style="text-align: center;">2</td><td style="text-align: center;">200</td><td style="text-align: center;">200</td><td></td></tr>
    <tr style="background-color: #e2e8f0; font-weight: bold;">
      <td colspan="4" style="text-align: center;">المجموع العام</td>
      <td style="text-align: center;">10</td>
      <td style="text-align: center;">1000</td>
      <td style="text-align: center;">1000</td>
      <td></td>
    </tr>
  </tbody>
</table>

<div style="margin-top: 25px; display: flex; justify-content: space-between;">
  <span style="font-size: 14px; font-weight: bold;">حرر بـ [المكان] في 26 نونبر 2026</span>
  <div style="border: 1px dashed #64748b; padding: 15px 25px; text-align: center; border-radius: 6px; min-width: 240px;">
    <p style="font-weight: bold; margin: 0 0 5px 0;">توقيع مسير التعاونية: بلال الوادي</p>
    <p style="font-size: 12px; color: #64748b; margin: 0 0 30px 0;">(مصادق عليه)</p>
  </div>
</div>
`;

// 4. التزام بوضع مقر رهن الإشارة (أبيض وأسود فقط، نص خالص بدون أي جداول)
const doc4Content = `
<div style="font-family: 'Times New Roman', Times, Arial, Tahoma, sans-serif; direction: rtl; text-align: right; line-height: 2.2; color: #000000; background-color: #ffffff; max-width: 750px; margin: 0 auto; padding: 30px 25px;">
  <div style="text-align: center; margin-bottom: 35px;">
    <p style="font-size: 16px; font-weight: bold; color: #000000; margin: 0 0 10px 0;">المملكة المغربية</p>
    <h1 style="font-size: 24px; font-weight: bold; color: #000000; margin: 10px 0; text-decoration: underline; text-underline-offset: 6px;">التزام بوضع مقر رهن الإشارة</h1>
  </div>

  <p style="font-size: 16px; font-weight: bold; color: #000000; margin-bottom: 12px;">أنا الموقع(ة) أسفله:</p>
  
  <div style="margin: 0 25px 25px 0; font-size: 15px; line-height: 2.4; color: #000000;">
    <p style="margin: 6px 0;">• <strong>الاسم الكامل:</strong> [الاسم الكامل لصاحب العقار]</p>
    <p style="margin: 6px 0;">• <strong>رقم البطاقة الوطنية للتعريف (CIN):</strong> [رقم البطاقة الوطنية]</p>
    <p style="margin: 6px 0;">• <strong>الساكن(ة) بـ:</strong> [العنوان الشخصي الكامل لصاحب العقار]</p>
  </div>

  <p style="font-size: 15px; text-align: justify; margin-bottom: 25px; line-height: 2.2; color: #000000;">
    أصرح وألتزم بصفتي مالكاً(ة) (أو مستغلاً قانونياً) للعقار الكائن بـ: <strong>[العنوان الكامل للمقر، الجماعة، الإقليم]</strong>، بأنني أضع هذا المحل رهن إشارة <strong>تعاونية مراعي الوادي</strong>، في طور التأسيس، بصفة مجانية، وذلك لاتخاذه مقراً اجتماعياً لها ولمزاولة أنشطتها المنصوص عليها في نظامها الأساسي.
  </p>

  <p style="font-size: 15px; text-align: justify; margin-bottom: 45px; line-height: 2.2; color: #000000;">
    وقد سلمت هذا الالتزام للإدلاء به عند الحاجة لدى السلطات الإدارية والقضائية المختصة.
  </p>

  <div style="margin-top: 50px;">
    <div style="float: right; font-size: 15px; font-weight: bold; color: #000000; padding-top: 10px;">
      حرر بـ: [المكان] في 26 نونبر 2026
    </div>
    <div style="float: left; text-align: center; width: 260px; min-height: 120px; box-sizing: border-box;">
      <p style="font-size: 15px; font-weight: bold; margin: 0 0 8px 0; color: #000000;">إمضاء المصرح(ة)</p>
      <p style="font-size: 12px; margin: 0; color: #000000;">(مصادق عليه لدى السلطة المختصة)</p>
    </div>
    <div style="clear: both;"></div>
  </div>
</div>
`;

// Combined Full Packet
const fullPacketContent = `
<div style="text-align: center; border-bottom: 3px double #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
  <p style="font-size: 16px; color: #475569; margin: 0;">المملكة المغربية — القانون رقم 112.12 المتعلق بالتعاونيات</p>
  <h1 style="font-size: 28px; font-weight: 900; color: #1e3a8a; margin: 12px 0;">الملف القانوني الكامل لتأسيس التعاونية</h1>
  <p style="font-size: 20px; font-weight: bold; color: #0284c7; margin: 0;">تعاونية: مراعي الوادي</p>
</div>

${doc1Content}
<div class="page-break" style="page-break-before: always; margin-top: 40px;"></div>

${doc2Content}
<div class="page-break" style="page-break-before: always; margin-top: 40px;"></div>

${doc3Content}
<div class="page-break" style="page-break-before: always; margin-top: 40px;"></div>

${doc4Content}
`;

// Save files
const files = [
  { name: '01-محضر-الجمع-العام-التأسيسي', title: 'محضر الجمع العام التأسيسي', content: doc1Content },
  { name: '02-النظام-الأساسي-للتعاونية', title: 'النظام الأساسي للتعاونية', content: doc2Content },
  { name: '03-لائحة-المؤسسين-والمكتتبين', title: 'لائحة الأعضاء المؤسسين والمكتتبين', content: doc3Content },
  { name: '04-التزام-بوضع-مقر-رهن-الإشارة', title: 'التزام بوضع مقر رهن الإشارة', content: doc4Content },
  { name: 'ملف-تأسيس-تعاونية-مراعي-الوادي-الكامل', title: 'الملف القانوني الكامل لتأسيس تعاونية مراعي الوادي', content: fullPacketContent },
];

for (const f of files) {
  const docPath = path.join(targetDir, `${f.name}.doc`);
  const htmlPath = path.join(targetDir, `${f.name}.html`);
  const wrapped = wrapWordDoc(f.title, f.content);
  fs.writeFileSync(docPath, wrapped, 'utf8');
  fs.writeFileSync(htmlPath, wrapped, 'utf8');
  console.log(`✅ Saved: ${f.name}.doc & .html`);
}

console.log('🎉 Successfully created all cooperative documents!');
