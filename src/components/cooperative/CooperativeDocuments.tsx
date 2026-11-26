'use client';

import { useState } from 'react';
import { Card, Badge, Modal } from '@/components/ui';
import type { CooperativeProfile, CooperativeMember } from '@/lib/types';
import {
  FileText,
  Download,
  Printer,
  Eye,
  FileCheck,
  CheckCircle2,
  FolderDown,
  Building2,
  Users,
  Copy,
  Edit3,
  Calendar,
  MapPin,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface CooperativeDocumentsProps {
  profile: CooperativeProfile;
  members: CooperativeMember[];
}

interface FounderItem {
  id: number;
  fullName: string;
  cin: string;
  address: string;
  shares: number;
  subscribedAmount: number;
  paidAmount: number;
  role: string;
}

export default function CooperativeDocuments({ profile, members }: CooperativeDocumentsProps) {
  // Document Customization Form State
  const [coopName, setCoopName] = useState('مراعي الوادي');
  const [managerName, setManagerName] = useState('بلال الوادي');
  const [managerCin, setManagerCin] = useState('CD916618');
  const [managerMandate, setManagerMandate] = useState('3 سنوات');
  const [assemblyDate, setAssemblyDate] = useState('26 نونبر 2026');
  const [assemblyDay, setAssemblyDay] = useState('الخميس');
  const [assemblyTimeStart, setAssemblyTimeStart] = useState('10:00');
  const [assemblyTimeEnd, setAssemblyTimeEnd] = useState('12:30');
  const [cityPlace, setCityPlace] = useState('عين شقف');
  const [headquartersAddress, setHeadquartersAddress] = useState(
    profile.headquarters || 'جماعة عين شقف، إقليم مولاي يعقوب'
  );

  // Cooperative name helpers to prevent duplicate "تعاونية"
  const cleanCoopName = coopName.replace(/^تعاونية\s*:?\s*/, '').trim() || 'مراعي الوادي';
  const fullCoopTitle = `تعاونية ${cleanCoopName}`;

  // Property Owner state for Document 4 (Engagement)
  const [ownerName, setOwnerName] = useState('[الاسم الكامل لصاحب العقار]');
  const [ownerCin, setOwnerCin] = useState('[رقم البطاقة الوطنية]');
  const [ownerAddress, setOwnerAddress] = useState('[العنوان الشخصي لصاحب العقار]');

  // Capital details
  const [totalCapital, setTotalCapital] = useState(1000);
  const [totalShares, setTotalShares] = useState(10);
  const [shareValue, setShareValue] = useState(100);

  // Founders list (5 minimum required by Moroccan Law 112.12)
  const [founders, setFounders] = useState<FounderItem[]>([
    {
      id: 1,
      fullName: 'بلال الوادي',
      cin: 'CD916618',
      address: '[العنوان الشخصي للمسير]',
      shares: 2,
      subscribedAmount: 200,
      paidAmount: 200,
      role: 'مسير / مؤسس',
    },
    {
      id: 2,
      fullName: '[الاسم الكامل للعضو الثاني]',
      cin: '[رقم CIN الثاني]',
      address: '[العنوان الشخصي]',
      shares: 2,
      subscribedAmount: 200,
      paidAmount: 200,
      role: 'عضو مؤسس',
    },
    {
      id: 3,
      fullName: '[الاسم الكامل للعضو الثالث]',
      cin: '[رقم CIN الثالث]',
      address: '[العنوان الشخصي]',
      shares: 2,
      subscribedAmount: 200,
      paidAmount: 200,
      role: 'عضو مؤسس',
    },
    {
      id: 4,
      fullName: '[الاسم الكامل للعضو الرابع]',
      cin: '[رقم CIN الرابع]',
      address: '[العنوان الشخصي]',
      shares: 2,
      subscribedAmount: 200,
      paidAmount: 200,
      role: 'عضو مؤسس',
    },
    {
      id: 5,
      fullName: '[الاسم الكامل للعضو الخامس]',
      cin: '[رقم CIN الخامس]',
      address: '[العنوان الشخصي]',
      shares: 2,
      subscribedAmount: 200,
      paidAmount: 200,
      role: 'عضو مؤسس',
    },
  ]);

  // Modal State
  const [previewDoc, setPreviewDoc] = useState<{ id: string; title: string; html: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function updateFounder(id: number, field: keyof FounderItem, value: any) {
    setFounders(prev =>
      prev.map(f => {
        if (f.id === id) {
          const updated = { ...f, [field]: value };
          if (field === 'shares') {
            const sh = Number(value) || 0;
            updated.subscribedAmount = sh * shareValue;
            updated.paidAmount = sh * shareValue;
          }
          return updated;
        }
        return f;
      })
    );
  }

  // --- Document HTML Generators ---

  // Document 1: محضر الجمع العام التأسيسي
  function generateDoc1HTML(): string {
    const foundersTableRows = founders
      .map(
        f => `
      <tr>
        <td style="text-align: center; border: 1px solid #475569; padding: 6px;">${f.id}</td>
        <td style="border: 1px solid #475569; padding: 6px; font-weight: bold;">${f.fullName}</td>
        <td style="text-align: center; border: 1px solid #475569; padding: 6px;">${f.cin}</td>
        <td style="text-align: center; border: 1px solid #475569; padding: 6px;">${f.role}</td>
        <td style="border: 1px solid #475569; padding: 6px; width: 140px;"></td>
      </tr>
    `
      )
      .join('');

    return `
      <div style="font-family: Arial, Tahoma, sans-serif; direction: rtl; text-align: right; line-height: 1.6; color: #0f172a; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 18px;">
          <p style="font-size: 13px; color: #475569; margin: 0;">المملكة المغربية — ملف تأسيس تعاونية وفق القانون رقم 112.12</p>
          <h1 style="font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 8px 0 4px 0;">محضر الجمع العام التأسيسي</h1>
          <p style="font-size: 16px; font-weight: bold; color: #0284c7; margin: 0;">تعاونية: ${cleanCoopName}</p>
        </div>

        <p style="text-align: justify; font-size: 14px; margin-bottom: 14px;">
          في يوم <strong>${assemblyDay} ${assemblyDate}</strong> على الساعة <strong>العاشرة صباحاً (${assemblyTimeStart})</strong>، انعقد بمقر <strong>${headquartersAddress}</strong>، الجمع العام التأسيسي لـ <strong>${fullCoopTitle}</strong>، وذلك بحضور الأعضاء المؤسسين الموقعة أسماؤهم أسفله.
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
          <li><strong>القرار الأول:</strong> المصادقة على النظام الأساسي لـ <strong>${fullCoopTitle}</strong> وفق مقتضيات القانون رقم 112.12 المتعلق بالتعاونيات، مع تحديد مقرها الاجتماعي بـ <strong>${headquartersAddress}</strong>.</li>
          <li><strong>القرار الثاني:</strong> المصادقة على لائحة الأعضاء المؤسسين المكتتبين في رأس مال التعاونية المحدد في مبلغ <strong>${totalCapital} درهم (ألف درهم)</strong>، والمقسم إلى <strong>${totalShares} حصص</strong> اجتماعية بقيمة <strong>${shareValue} درهم</strong> لكل حصة.</li>
          <li><strong>القرار الثالث:</strong> تعيين السيد <strong>${managerName}</strong>، الحامل للبطاقة الوطنية للتعريف رقم <strong>${managerCin}</strong>، مسيراً وحيداً للتعاونية لمدة [${managerMandate}]، مع تخويله جميع الصلاحيات القانونية لتسيير شؤون التعاونية وتمثيلها.</li>
          <li><strong>القرار الرابع:</strong> تفويض مسير التعاونية السيد <strong>${managerName}</strong>، الحامل للبطاقة الوطنية للتعريف رقم <strong>${managerCin}</strong>، للقيام بجميع الإجراءات اللازمة لفتح الحساب البنكي المجمد، وإيداع ملف التأسيس لدى السلطة المحلية، وتسجيل التعاونية بالسجل المحلي للتعاونيات بالمحكمة الابتدائية.</li>
        </ul>

        <p style="font-size: 14px; margin-top: 10px;">ورفعت الجلسة على الساعة الثانية عشرة والنصف زوالاً (<strong>${assemblyTimeEnd}</strong>) من نفس اليوم.</p>

        <h3 style="font-size: 15px; color: #1e3a8a; margin: 18px 0 8px 0;">توقيعات الأعضاء المؤسسين:</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px;">
          <thead>
            <tr style="background-color: #1e3a8a; color: white;">
              <th style="border: 1px solid #475569; padding: 6px; width: 40px;">ر.ت</th>
              <th style="border: 1px solid #475569; padding: 6px;">الاسم الكامل</th>
              <th style="border: 1px solid #475569; padding: 6px; width: 110px;">رقم البطاقة (CIN)</th>
              <th style="border: 1px solid #475569; padding: 6px; width: 100px;">الصفة</th>
              <th style="border: 1px solid #475569; padding: 6px; width: 140px;">التوقيع</th>
            </tr>
          </thead>
          <tbody>
            ${foundersTableRows}
          </tbody>
        </table>

        <div style="margin-top: 15px; display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
          <span>حرر بـ ${cityPlace} في ${assemblyDate}</span>
          <span>توقيع مسير التعاونية (مصادق عليه)</span>
        </div>
      </div>
    `;
  }

  // Document 2: النظام الأساسي للتعاونية
  function generateDoc2HTML(): string {
    const foundersSignatures = founders
      .map(
        f => `
      <tr>
        <td style="text-align: center; border: 1px solid #475569; padding: 6px;">${f.id}</td>
        <td style="border: 1px solid #475569; padding: 6px; font-weight: bold;">${f.fullName}</td>
        <td style="text-align: center; border: 1px solid #475569; padding: 6px;">${f.cin}</td>
        <td style="border: 1px solid #475569; padding: 6px; width: 160px;"></td>
      </tr>
    `
      )
      .join('');

    return `
      <div style="font-family: Arial, Tahoma, sans-serif; direction: rtl; text-align: right; line-height: 1.6; color: #0f172a; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 18px;">
          <p style="font-size: 13px; color: #475569; margin: 0;">المملكة المغربية — وفق مقتضيات القانون رقم 112.12 المتعلق بالتعاونيات</p>
          <h1 style="font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 8px 0 4px 0;">النظام الأساسي للتعاونية</h1>
          <p style="font-size: 16px; font-weight: bold; color: #0284c7; margin: 0;">تعاونية: ${cleanCoopName}</p>
        </div>

        <h3 style="font-size: 16px; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">الباب الأول: التأسيس، التسمية، المقر، المدة، والغرض</h3>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 1 (التأسيس والتسمية):</strong> تؤسس بين الموقعين على هذا النظام الأساسي والمنخرطين لاحقاً، تعاونية خاضعة لمقتضيات القانون رقم 112.12 المتعلق بالتعاونيات، تحمل تسمية: <strong>${fullCoopTitle}</strong>.
        </p>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 2 (المقر الاجتماعي):</strong> يحدد المقر الاجتماعي للتعاونية بـ: <strong>${headquartersAddress}</strong>. ويمكن نقله إلى أي مكان آخر بقرار يتخذه الجمع العام.
        </p>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 3 (المدة):</strong> حددت مدة التعاونية في <strong>99 سنة</strong> تبتدئ من تاريخ تسجيلها في السجل المحلي للتعاونيات، ما لم يتم حلها قبل الأوان أو تمديدها وفق القانون.
        </p>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 4 (الغرض والنشاط):</strong> تهدف التعاونية إلى مزاولة الأنشطة الفلاحية التالية:
        </p>
        <ul style="font-size: 13px; margin: 0 20px 10px 0; padding: 0;">
          <li><strong>الغرض الرئيسي:</strong> تربية الدواجن.</li>
          <li><strong>الأنشطة الأخرى:</strong> تربية المواشي، إنتاج الأعلاف البديلة وتثمينها، وتسويق المنتوجات الفلاحية.</li>
          <li>القيام بجميع العمليات التجارية والمالية المرتبطة بشكل مباشر أو غير مباشر بغرضها الاجتماعي.</li>
        </ul>

        <h3 style="font-size: 16px; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 14px;">الباب الثاني: رأس المال والحصص الاجتماعية</h3>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 5 (رأس المال):</strong> يحدد رأس المال المكتتب به عند التأسيس في مبلغ <strong>${totalCapital} درهم (ألف درهم)</strong>، مقسم إلى <strong>${totalShares} حصص</strong> اجتماعية، قيمة كل حصة <strong>${shareValue} درهم</strong>.
        </p>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 6 (تحرير الحصص):</strong> يلتزم كل عضو بتحرير ربع قيمة الحصص المكتتب بها على الأقل عند التأسيس، ويتم تحرير الباقي داخل أجل لا يتعدى ثلاث سنوات من تاريخ التسجيل.
        </p>

        <h3 style="font-size: 16px; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 14px;">الباب الثالث: العضوية</h3>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 7 (شروط الانخراط):</strong> يقبل عضواً في التعاونية كل شخص ذاتي أو اعتباري تتوفر فيه الشروط القانونية ويمارس نشاطاً يدخل في غرض التعاونية، بعد موافقة المسير والجمع العام.
        </p>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 8 (الانسحاب والفصل):</strong> لكل عضو الحق في الانسحاب من التعاونية بتوجيه إشعار كتابي، كما يمكن فصل أي عضو يخل بالتزاماته بقرار معلل من الجمع العام.
        </p>

        <h3 style="font-size: 16px; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 14px;">الباب الرابع: التسيير والجموع العامة</h3>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 9 (الجمع العام):</strong> يتكون الجمع العام من جميع الأعضاء، ولكل عضو صوت واحد مهما كان عدد حصصه. ينعقد الجمع العام العادي مرة في السنة على الأقل خلال الستة أشهر الموالية لاختتام السنة المالية.
        </p>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 10 (التسيير):</strong> يسير التعاونية <strong>مسير واحد</strong> يعينه الجمع العام لمدة [${managerMandate}]، وذلك طبقاً لمقتضيات القانون رقم 112.12 المتعلق بالتعاونيات، ويتمتع بكامل الصلاحيات القانونية لإدارة شؤون التعاونية وتمثيلها أمام الإدارات والمؤسسات البنكية والقضائية.
        </p>

        <h3 style="font-size: 16px; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 14px;">الباب الخامس: السنة المالية، توزيع الفائض، والحل</h3>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 11 (السنة المالية):</strong> تبتدئ السنة المالية في فاتح يناير وتنتهي في 31 دجنبر من كل سنة. واستثناءً، تبتدئ السنة الأولى من تاريخ التسجيل بالسجل المحلي للتعاونيات.
        </p>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 12 (توزيع الفائض):</strong> يخصص <strong>10% على الأقل</strong> من الفائض الصافي لتكوين الاحتياطي القانوني، ويوزع الباقي وفق مقتضيات القانون رقم 112.12 وقرارات الجمع العام.
        </p>
        <p style="font-size: 13px; text-align: justify; margin: 6px 0;">
          <strong>المادة 13 (الحل والتصفية):</strong> في حالة حل التعاونية، يؤول صافي الأصول بعد تصفية الديون واسترجاع الأعضاء لقيمة حصصهم إلى تعاونية أخرى أو اتحاد تعاونيات أو مكتب تنمية التعاون.
        </p>

        <p style="font-size: 14px; font-weight: bold; margin-top: 15px;">حرر بـ ${cityPlace} في ${assemblyDate}</p>

        <h3 style="font-size: 15px; color: #1e3a8a; margin: 15px 0 8px 0;">توقيعات جميع الأعضاء المؤسسين (مصادق عليها):</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px;">
          <thead>
            <tr style="background-color: #1e3a8a; color: white;">
              <th style="border: 1px solid #475569; padding: 6px; width: 40px;">ر.ت</th>
              <th style="border: 1px solid #475569; padding: 6px;">الاسم الكامل</th>
              <th style="border: 1px solid #475569; padding: 6px; width: 120px;">رقم البطاقة (CIN)</th>
              <th style="border: 1px solid #475569; padding: 6px; width: 160px;">التوقيع</th>
            </tr>
          </thead>
          <tbody>
            ${foundersSignatures}
          </tbody>
        </table>
      </div>
    `;
  }

  // Document 3: لائحة الأعضاء المؤسسين المكتتبين في رأس المال
  function generateDoc3HTML(): string {
    const totalSubscribed = founders.reduce((acc, cur) => acc + cur.subscribedAmount, 0);
    const totalPaid = founders.reduce((acc, cur) => acc + cur.paidAmount, 0);
    const totalSharesCount = founders.reduce((acc, cur) => acc + cur.shares, 0);

    const rows = founders
      .map(
        f => `
      <tr>
        <td style="text-align: center; border: 1px solid #475569; padding: 6px;">${f.id}</td>
        <td style="border: 1px solid #475569; padding: 6px; font-weight: bold;">${f.fullName}</td>
        <td style="text-align: center; border: 1px solid #475569; padding: 6px;">${f.cin}</td>
        <td style="border: 1px solid #475569; padding: 6px; font-size: 12px;">${f.address}</td>
        <td style="text-align: center; border: 1px solid #475569; padding: 6px; font-weight: bold;">${f.shares}</td>
        <td style="text-align: center; border: 1px solid #475569; padding: 6px;">${f.subscribedAmount}</td>
        <td style="text-align: center; border: 1px solid #475569; padding: 6px;">${f.paidAmount}</td>
        <td style="border: 1px solid #475569; padding: 6px; width: 110px;"></td>
      </tr>
    `
      )
      .join('');

    return `
      <div style="font-family: Arial, Tahoma, sans-serif; direction: rtl; text-align: right; line-height: 1.6; color: #0f172a; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 18px;">
          <p style="font-size: 13px; color: #475569; margin: 0;">المملكة المغربية — ملف تأسيس تعاونية وفق القانون رقم 112.12</p>
          <h1 style="font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 8px 0 4px 0;">لائحة الأعضاء المؤسسين المكتتبين في رأس المال</h1>
          <p style="font-size: 16px; font-weight: bold; color: #0284c7; margin: 0;">تعاونية: ${cleanCoopName}</p>
        </div>

        <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 15px; margin-bottom: 15px; font-size: 14px; display: flex; justify-content: space-around; font-weight: bold;">
          <span>رأس المال المكتتب به: <span style="color: #1e3a8a;">${totalSubscribed} درهم</span></span>
          <span>عدد الحصص: <span style="color: #1e3a8a;">${totalSharesCount} حصص</span></span>
          <span>القيمة الاسمية للحصة: <span style="color: #1e3a8a;">${shareValue} درهم</span></span>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px;">
          <thead>
            <tr style="background-color: #1e3a8a; color: white;">
              <th style="border: 1px solid #475569; padding: 6px; width: 35px;">ر.ت</th>
              <th style="border: 1px solid #475569; padding: 6px;">الاسم الكامل</th>
              <th style="border: 1px solid #475569; padding: 6px; width: 95px;">رقم البطاقة (CIN)</th>
              <th style="border: 1px solid #475569; padding: 6px;">العنوان الشخصي</th>
              <th style="border: 1px solid #475569; padding: 6px; width: 45px;">عدد الحصص</th>
              <th style="border: 1px solid #475569; padding: 6px; width: 75px;">المبلغ المكتتب (درهم)</th>
              <th style="border: 1px solid #475569; padding: 6px; width: 75px;">المبلغ المحرر (درهم)</th>
              <th style="border: 1px solid #475569; padding: 6px; width: 100px;">التوقيع</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr style="background-color: #e2e8f0; font-weight: bold;">
              <td colspan="4" style="text-align: center; border: 1px solid #475569; padding: 8px;">المجموع العام</td>
              <td style="text-align: center; border: 1px solid #475569; padding: 8px;">${totalSharesCount}</td>
              <td style="text-align: center; border: 1px solid #475569; padding: 8px;">${totalSubscribed}</td>
              <td style="text-align: center; border: 1px solid #475569; padding: 8px;">${totalPaid}</td>
              <td style="border: 1px solid #475569; padding: 8px;"></td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 25px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="font-size: 14px; font-weight: bold;">
            حرر بـ ${cityPlace} في ${assemblyDate}
          </div>
          <div style="border: 1px dashed #64748b; padding: 15px 25px; text-align: center; border-radius: 6px; min-width: 250px;">
            <p style="font-size: 14px; font-weight: bold; margin: 0 0 8px 0;">توقيع مسير التعاونية: ${managerName}</p>
            <p style="font-size: 12px; color: #64748b; margin: 0 0 35px 0;">(مصادق عليه)</p>
          </div>
        </div>
      </div>
    `;
  }

  // Document 4: التزام بوضع مقر رهن الإشارة (أبيض وأسود فقط، نص خالص بدون أي جداول)
  function generateDoc4HTML(): string {
    return `
      <div style="font-family: 'Times New Roman', Times, Arial, Tahoma, sans-serif; direction: rtl; text-align: right; line-height: 2.2; color: #000000; background-color: #ffffff; max-width: 750px; margin: 0 auto; padding: 30px 25px;">
        <div style="text-align: center; margin-bottom: 35px;">
          <p style="font-size: 16px; font-weight: bold; color: #000000; margin: 0 0 10px 0;">المملكة المغربية</p>
          <h1 style="font-size: 24px; font-weight: bold; color: #000000; margin: 10px 0; text-decoration: underline; text-underline-offset: 6px;">التزام بوضع مقر رهن الإشارة</h1>
        </div>

        <p style="font-size: 16px; font-weight: bold; color: #000000; margin-bottom: 12px;">أنا الموقع أسفله:</p>
        
        <div style="margin: 0 25px 25px 0; font-size: 15px; line-height: 2.4; color: #000000;">
          <p style="margin: 6px 0;">• <strong>الاسم الكامل:</strong> ${ownerName}</p>
          <p style="margin: 6px 0;">• <strong>رقم البطاقة الوطنية للتعريف (CIN):</strong> ${ownerCin}</p>
          <p style="margin: 6px 0;">• <strong>الساكن بـ:</strong> ${ownerAddress}</p>
        </div>

        <p style="font-size: 15px; text-align: justify; margin-bottom: 25px; line-height: 2.2; color: #000000;">
          أصرح وألتزم بصفتي مالكاً للعقار الكائن بـ: <strong>${headquartersAddress}</strong>، بأنني أضع هذا المحل رهن إشارة <strong>${fullCoopTitle}</strong>، في طور التأسيس، بصفة مجانية، وذلك لاتخاذه مقراً اجتماعياً لها ولمزاولة أنشطتها المنصوص عليها في نظامها الأساسي.
        </p>

        <p style="font-size: 15px; text-align: justify; margin-bottom: 45px; line-height: 2.2; color: #000000;">
          وقد سلمت هذا الالتزام للإدلاء به عند الحاجة لدى السلطات الإدارية والقضائية المختصة.
        </p>

        <div style="margin-top: 50px;">
          <div style="float: right; font-size: 15px; font-weight: bold; color: #000000; padding-top: 10px;">
            حرر بـ: ${cityPlace} في ${assemblyDate}
          </div>
          <div style="float: left; text-align: center; width: 260px; min-height: 120px; box-sizing: border-box;">
            <p style="font-size: 15px; font-weight: bold; margin: 0 0 8px 0; color: #000000;">إمضاء المصرح</p>
            <p style="font-size: 12px; margin: 0; color: #000000;">(مصادق عليه لدى السلطة المختصة)</p>
          </div>
          <div style="clear: both;"></div>
        </div>
      </div>
    `;
  }

  // Combine All 4 Documents into a single complete packet
  function generateCompleteDossierHTML(): string {
    return `
      <div style="font-family: Arial, Tahoma, sans-serif; direction: rtl; text-align: right;">
        <div style="text-align: center; border-bottom: 3px double #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
          <p style="font-size: 16px; color: #475569; margin: 0;">المملكة المغربية — القانون رقم 112.12 المتعلق بالتعاونيات</p>
          <h1 style="font-size: 28px; font-weight: 900; color: #1e3a8a; margin: 12px 0;">الملف القانوني الكامل لتأسيس التعاونية</h1>
          <p style="font-size: 20px; font-weight: bold; color: #0284c7; margin: 0;">تعاونية: ${coopName}</p>
          <p style="font-size: 13px; color: #64748b; margin-top: 8px;">يضم: محضر الجمع العام + النظام الأساسي + لائحة المكتتبين + التزام المقر</p>
        </div>

        <!-- الوثيقة 1 -->
        ${generateDoc1HTML()}
        <div style="page-break-after: always; margin: 40px 0; border-top: 2px dashed #94a3b8; padding-top: 20px;"></div>

        <!-- الوثيقة 2 -->
        ${generateDoc2HTML()}
        <div style="page-break-after: always; margin: 40px 0; border-top: 2px dashed #94a3b8; padding-top: 20px;"></div>

        <!-- الوثيقة 3 -->
        ${generateDoc3HTML()}
        <div style="page-break-after: always; margin: 40px 0; border-top: 2px dashed #94a3b8; padding-top: 20px;"></div>

        <!-- الوثيقة 4 -->
        ${generateDoc4HTML()}
      </div>
    `;
  }

  // --- Handlers: Word Download (.doc) ---
  function downloadAsWord(filename: string, title: string, htmlBody: string) {
    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${title}</title>
        <style>
          body {
            font-family: 'Arial', 'Segoe UI', Tahoma, sans-serif;
            direction: rtl;
            text-align: right;
            padding: 24px;
            line-height: 1.6;
          }
          h1, h2, h3 { color: #1e3a8a; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
          th, td { border: 1px solid #64748b; padding: 7px 10px; text-align: right; font-size: 12px; }
          th { background-color: #f1f5f9; font-weight: bold; }
          .page-break { page-break-before: always; }
        </style>
      </head>
      <body>
        <div class="Section1">
          ${htmlBody}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // --- Handlers: Print / PDF Export ---
  function printDocument(title: string, htmlBody: string) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page { size: A4; margin: 18mm 15mm; }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            direction: rtl;
            text-align: right;
            line-height: 1.6;
            color: #0f172a;
            background: white;
            padding: 10px;
          }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border: 1px solid #475569; padding: 6px 10px; text-align: right; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${htmlBody}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  // Copy text helper
  function copyTextToClipboard(id: string, text: string) {
    // Strip HTML tags for clean text copy
    const div = document.createElement('div');
    div.innerHTML = text;
    const plainText = div.innerText || div.textContent || '';
    navigator.clipboard.writeText(plainText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  // Documents list configuration
  const documentsList = [
    {
      id: 'doc1',
      title: 'محضر الجمع العام التأسيسي',
      subTitle: 'Procès-Verbal de l’Assemblée Générale Constitutive',
      description: 'إثبات انعقاد الجمع العام، المصادقة على النظام الأساسي، وتعيين المسير وتفويضه للتسجيل.',
      requiredCopies: '5 نسخ أصلية مصادق عليها',
      badgeColor: 'blue',
      icon: FileText,
      getHtml: generateDoc1HTML,
      filename: `01-محضر-الجمع-العام-التأسيسي-${coopName.replace(/\s+/g, '-')}`,
      staticDoc: '/documents/cooperative/01-محضر-الجمع-العام-التأسيسي.doc',
    },
    {
      id: 'doc2',
      title: 'النظام الأساسي للتعاونية',
      subTitle: 'Statuts de la Coopérative (Loi 112.12)',
      description: 'الدستور الداخلي: النشاط (تربية الدواجن والمواشي والأعلاف)، رأس المال، الحصص، وتوزيع الفائض.',
      requiredCopies: '5 نسخ أصلية مصادق عليها',
      badgeColor: 'emerald',
      icon: ShieldCheck,
      getHtml: generateDoc2HTML,
      filename: `02-النظام-الأساسي-${coopName.replace(/\s+/g, '-')}`,
      staticDoc: '/documents/cooperative/02-النظام-الأساسي-للتعاونية.doc',
    },
    {
      id: 'doc3',
      title: 'لائحة الأعضاء المؤسسين والمكتتبين',
      subTitle: 'Liste des Souscripteurs au Capital',
      description: 'جدول رأس المال (1000 درهم)، توزيع الحصص (10 حصص × 100 درهم) وتوقيعات المكتتبين.',
      requiredCopies: '5 نسخ أصلية مصادق عليها',
      badgeColor: 'purple',
      icon: Users,
      getHtml: generateDoc3HTML,
      filename: `03-لائحة-المؤسسين-والمكتتبين-${coopName.replace(/\s+/g, '-')}`,
      staticDoc: '/documents/cooperative/03-لائحة-المؤسسين-والمكتتبين.doc',
    },
    {
      id: 'doc4',
      title: 'التزام بوضع مقر رهن الإشارة',
      subTitle: 'Engagement de Mise à Disposition du Local',
      description: 'شهادة مجانية المقر الاجتماعي مصادق عليها من صاحب العقار/الضيعة لفائدة التعاونية.',
      requiredCopies: '5 نسخ مصادق عليها',
      badgeColor: 'amber',
      icon: Building2,
      getHtml: generateDoc4HTML,
      filename: `04-التزام-بوضع-مقر-رهن-الإشارة-${coopName.replace(/\s+/g, '-')}`,
      staticDoc: '/documents/cooperative/04-التزام-بوضع-مقر-رهن-الإشارة.doc',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-blue-500/20 rounded-lg text-blue-300">
                <FolderDown className="w-6 h-6" />
              </span>
              <h2 className="text-xl md:text-2xl font-black">الملف القانوني لتأسيس التعاونية (القانون 112.12)</h2>
              <Badge color="blue">4 ملفات رسمية</Badge>
            </div>
            <p className="text-sm text-blue-100/80 max-w-2xl leading-relaxed">
              جميع الوثائق القانونية المطلوبة لتأسيس <strong>{coopName}</strong> مفصولة وجاهزة للتحميل الفوري
              بصيغة <strong>Word (.doc)</strong> قابلة للتعديل أو <strong>للطباعة الرسمية المباشرة (PDF)</strong> في 5 نسخ لكل وثيقة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/documents/cooperative/ملف-تأسيس-تعاونية-مراعي-الوادي-الكامل.doc"
              download
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-700/80 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition border border-indigo-400/30 shadow-sm"
              title="تحميل الملف الأصلي كما هو بصيغة Word"
            >
              <FolderDown className="w-4 h-4 text-indigo-200" />
              القالب الأصلي (.doc)
            </a>
            <button
              onClick={() =>
                downloadAsWord(
                  `ملف-تأسيس-كامل-${coopName.replace(/\s+/g, '-')}`,
                  `ملف تأسيس ${coopName} الكامل`,
                  generateCompleteDossierHTML()
                )
              }
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition shadow-sm"
            >
              <Download className="w-4 h-4" />
              تحميل الملف الكامل (Word)
            </button>
            <button
              onClick={() =>
                printDocument(`ملف تأسيس ${coopName} الكامل`, generateCompleteDossierHTML())
              }
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold rounded-xl text-sm transition"
            >
              <Printer className="w-4 h-4" />
              طباعة الملف الشامل (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* Fast Customizer Accordion / Card */}
      <Card className="p-5 border-blue-100 bg-gradient-to-br from-blue-50/50 to-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-base">تخصيص بيانات وثائق التأسيس قبل الطباعة والتحميل</h3>
          </div>
          <span className="text-xs text-slate-500">التعديلات تنعكس تلقائياً وفورياً على جميع الوثائق الأربعة</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">اسم التعاونية</label>
            <input
              type="text"
              value={coopName}
              onChange={e => setCoopName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">المسير القانوني المعين</label>
            <input
              type="text"
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">رقم بطاقة المسير (CIN)</label>
            <input
              type="text"
              value={managerCin}
              onChange={e => setManagerCin(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">تاريخ الجمع العام والمكان</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={assemblyDate}
                onChange={e => setAssemblyDate(e.target.value)}
                placeholder="التاريخ"
                className="w-2/3 px-3 py-2 border rounded-lg bg-white font-semibold text-slate-800"
              />
              <input
                type="text"
                value={cityPlace}
                onChange={e => setCityPlace(e.target.value)}
                placeholder="المدينة / المكان"
                className="w-1/3 px-3 py-2 border rounded-lg bg-white font-semibold text-slate-800"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">العنوان الكامل للمقر الاجتماعي للتعاونية</label>
            <input
              type="text"
              value={headquartersAddress}
              onChange={e => setHeadquartersAddress(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">صاحب العقار (للوثيقة 4: التزام المقر)</label>
            <input
              type="text"
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder="اسم صاحب العقار أو الضيعة"
              className="w-full px-3 py-2 border rounded-lg bg-white font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">رقم CIN لصاحب العقار</label>
            <input
              type="text"
              value={ownerCin}
              onChange={e => setOwnerCin(e.target.value)}
              placeholder="CIN صاحب العقار"
              className="w-full px-3 py-2 border rounded-lg bg-white font-semibold text-slate-800"
            />
          </div>
        </div>
      </Card>

      {/* The 4 Separate Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {documentsList.map((doc, idx) => {
          const Icon = doc.icon;
          const htmlContent = doc.getHtml();

          return (
            <Card key={doc.id} className="p-5 flex flex-col justify-between hover:shadow-md transition border-slate-200">
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="font-black text-slate-800 text-base">{doc.title}</h3>
                      <p className="text-xs text-slate-400 font-sans">{doc.subTitle}</p>
                    </div>
                  </div>
                  <Badge color="blue">{doc.requiredCopies}</Badge>
                </div>

                <p className="text-xs text-slate-600 mb-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {doc.description}
                </p>
                <div className="flex items-center justify-between text-[11px] mb-3">
                  <span className="text-slate-400">صيغة الملف: Word (.doc) + PDF</span>
                  <a
                    href={doc.staticDoc}
                    download
                    className="text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center gap-1"
                  >
                    <FolderDown className="w-3 h-3" />
                    تحميل القالب الأصلي (.doc)
                  </a>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewDoc({ id: doc.id, title: doc.title, html: htmlContent })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    معاينة
                  </button>
                  <button
                    onClick={() => copyTextToClipboard(doc.id, htmlContent)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs hover:bg-slate-50 transition"
                    title="نسخ نص الوثيقة"
                  >
                    {copiedId === doc.id ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedId === doc.id ? 'تم النسخ' : 'نسخ'}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => downloadAsWord(doc.filename, doc.title, htmlContent)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تحميل Word (.doc)
                  </button>
                  <button
                    onClick={() => printDocument(doc.title, htmlContent)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    طباعة / PDF
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Founders Table Customization & Details */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-800 text-base">
              لائحة الأعضاء المؤسسين الـ 5 (المكتتبين في رأس المال: 1000 درهم)
            </h3>
          </div>
          <Badge color="purple">القانون 112.12 يشترط 5 مؤسسين كحد أدنى</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-12 text-center">ر.ت</th>
                <th className="p-2.5">الاسم الكامل</th>
                <th className="p-2.5">رقم البطاقة (CIN)</th>
                <th className="p-2.5">العنوان الشخصي</th>
                <th className="p-2.5 w-20 text-center">عدد الحصص</th>
                <th className="p-2.5 w-24 text-center">المكتتب (د.م)</th>
                <th className="p-2.5 w-24 text-center">المحرر (د.م)</th>
                <th className="p-2.5">الصفة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {founders.map(f => (
                <tr key={f.id} className="hover:bg-slate-50/60">
                  <td className="p-2.5 text-center font-bold text-slate-500">{f.id}</td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={f.fullName}
                      onChange={e => updateFounder(f.id, 'fullName', e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-white font-semibold text-slate-800"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={f.cin}
                      onChange={e => updateFounder(f.id, 'cin', e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-white text-center font-mono"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={f.address}
                      onChange={e => updateFounder(f.id, 'address', e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-white text-slate-600"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="number"
                      min={1}
                      value={f.shares}
                      onChange={e => updateFounder(f.id, 'shares', e.target.value)}
                      className="w-16 px-2 py-1 border rounded bg-white text-center font-bold text-blue-700"
                    />
                  </td>
                  <td className="p-2.5 text-center font-bold text-slate-800">{f.subscribedAmount} د.م</td>
                  <td className="p-2.5 text-center font-bold text-emerald-700">{f.paidAmount} د.م</td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={f.role}
                      onChange={e => updateFounder(f.id, 'role', e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-white text-slate-700 text-xs"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-black text-slate-800 border-t border-slate-300">
              <tr>
                <td colSpan={4} className="p-2.5 text-center">
                  المجموع العام
                </td>
                <td className="p-2.5 text-center text-blue-700">
                  {founders.reduce((acc, cur) => acc + cur.shares, 0)} حصة
                </td>
                <td className="p-2.5 text-center text-slate-900">
                  {founders.reduce((acc, cur) => acc + cur.subscribedAmount, 0)} د.م
                </td>
                <td className="p-2.5 text-center text-emerald-800">
                  {founders.reduce((acc, cur) => acc + cur.paidAmount, 0)} د.م
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Moroccan Legal Administrative Roadmap */}
      <Card className="p-5 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
        <h3 className="font-bold text-emerald-900 text-base mb-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          خطوات إيداع الملف القانوني لتأسيس التعاونية (خارطة الطريق الرسمية)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black mb-2">
              1
            </span>
            <p className="font-bold text-slate-800 mb-1">المصادقة على التوقيعات</p>
            <p className="text-slate-500 leading-relaxed">
              طباعة 5 نسخ من كل ملف وتوجه المؤسسين الـ 5 لتصحيح الإمضاءات لدى المقاطعة أو الجماعة.
            </p>
          </div>

          <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black mb-2">
              2
            </span>
            <p className="font-bold text-slate-800 mb-1">فتح حساب بنكي مجمد</p>
            <p className="text-slate-500 leading-relaxed">
              إيداع رأس المال (1000 درهم) في حساب بنكي مجمد باسم التعاونية والحصول على شهادة بنكية بالتجميد.
            </p>
          </div>

          <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black mb-2">
              3
            </span>
            <p className="font-bold text-slate-800 mb-1">الإيداع لدى السلطة المحلية</p>
            <p className="text-slate-500 leading-relaxed">
              إيداع الملف المكتمل لدى الباشوية أو القيادة المختصة واستلام وصل الإيداع القانوني.
            </p>
          </div>

          <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black mb-2">
              4
            </span>
            <p className="font-bold text-slate-800 mb-1">التسجيل بالمحكمة الابتدائية</p>
            <p className="text-slate-500 leading-relaxed">
              قيد التعاونية في السجل المحلي للتعاونيات لدى كتابة الضبط بالمحكمة الابتدائية للحصول على الشخصية المعنوية.
            </p>
          </div>
        </div>
      </Card>

      {/* Preview Modal */}
      {previewDoc && (
        <Modal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={`معاينة وثيقة: ${previewDoc.title}`}
          size="xl"
        >
          <div className="p-2 space-y-4">
            <div className="flex justify-end gap-2 pb-3 border-b border-slate-200">
              <button
                onClick={() =>
                  downloadAsWord(
                    `${previewDoc.id}-${coopName.replace(/\s+/g, '-')}`,
                    previewDoc.title,
                    previewDoc.html
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
              >
                <Download className="w-3.5 h-3.5" />
                تحميل Word (.doc)
              </button>
              <button
                onClick={() => printDocument(previewDoc.title, previewDoc.html)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة / PDF
              </button>
            </div>
            <div
              className="p-4 bg-white border rounded-xl overflow-y-auto max-h-[70vh] shadow-inner text-sm"
              dangerouslySetInnerHTML={{ __html: previewDoc.html }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
