import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Seed catalog mirrored from production (https://wengz.tech).
 * Includes: service types (+ attributes), packages (incl. free + inactive),
 * finance settings, payment instructions, and maintenance mode.
 *
 * Free plan credits default to 500 (prod had 5; product override).
 */
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed (production catalog)...");

  await prisma.notification.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.withdrawalRequest.deleteMany();
  await prisma.providerFinanceDispute.deleteMany();
  await prisma.providerFinanceLedger.deleteMany();
  await prisma.providerWallet.deleteMany();
  await prisma.requestComment.deleteMany();
  await prisma.requestWatcher.deleteMany();
  await prisma.request.deleteMany();
  await prisma.paymentProof.deleteMany();
  await prisma.clientSubscription.deleteMany();
  await prisma.packageService.deleteMany();
  await prisma.package.deleteMany();
  await prisma.serviceType.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.contactMessage.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemSettings.deleteMany();

  console.log("🧹 Cleaned existing data");

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SEED_ADMIN_PASSWORD env var is required to seed the admin user in production"
      );
    }
    console.warn("⚠️  SEED_ADMIN_PASSWORD not set — using development-only default password");
  }
  const hashedAdminPassword = await bcrypt.hash(adminPassword || "DevOnly!ChangeMe123", 12);

  const admin = await prisma.user.create({
    data: {
      name: "Wengz",
      email: "nabraagency20@gmail.com",
      password: hashedAdminPassword,
      image: "/images/logo.svg",
      role: "SUPER_ADMIN",
    },
  });

  console.log("👤 Created admin:", admin.email);

  // ─── Service types (from wengz.tech) ───────────────────────────────────────

  const socialMediaDesign = await prisma.serviceType.create({
    data: {
      name: "Social Media Design",
      nameI18n: {
        ar: "تصميم لمنصات التواصل الاجتماعي",
        en: "Social Media Design",
      },
      description: "Professional designs for social media platforms",
      descriptionI18n: {
        ar: "تصميمات احترافية لمنصات التواصل الاجتماعي",
        en: "Professional designs for social media platforms",
      },
      icon: "👑",
      creditCost: 500,
      maxFreeRevisions: 1,
      paidRevisionCost: 250,
      resetFreeRevisionsOnPaid: true,
      maxDeliveryMinutes: 60,
      isActive: true,
      sortOrder: 1,
      attributes: [
        {
          type: "file",
          maxFiles: 5,
          question: "Upload your Logo or Brand Identity Guideline  ",
          required: true,
          maxSizeMB: 10,
          questionI18n: {
            ar: "اضف اللوجو أو ملفات الهوية الخاصة بك",
            en: "Upload your Logo or Brand Identity Guideline  ",
          },
        },
        {
          type: "voice",
          maxFiles: 1,
          question: "Record a voice note to simplify the requirements",
          required: false,
          maxSizeMB: 25,
          questionI18n: {
            ar: "تسجيل صوتي لتوضيح المطلوب",
            en: "Record a voice note to simplify the requirements",
          },
        },
        {
          type: "text",
          helpText: "Men aged from 20 to 30 (single or married)",
          question: "Who is your Target Audience?",
          required: true,
          placeholder: "e.g. Youth - Families - Women - Gen Z",
          helpTextI18n: {
            ar: "الرجال الذين تتراوح أعمارهم بين 20 و30 عاماً (عزاب أو متزوجون)",
            en: "Men aged from 20 to 30 (single or married)",
          },
          questionI18n: {
            ar: "من هو الجمهور المستهدف؟",
            en: "Who is your Target Audience?",
          },
          placeholderI18n: {
            ar: "e.g. Youth - Families - Women - Gen Z",
            en: "e.g. Youth - Families - Women - Gen Z",
          },
        },
        {
          type: "text",
          helpText: "e.g. phone number: 123456789",
          question: "What should we add for communication on the design?",
          required: true,
          placeholder: "e.g. Mobile number - WhatsApp - Instagram - Website",
          helpTextI18n: {
            ar: "e.g. phone number: 123456789",
            en: "e.g. phone number: 123456789",
          },
          questionI18n: {
            ar: "ماذا نضيف للتواصل على التصميم؟",
            en: "What should we add for communication on the design?",
          },
          placeholderI18n: {
            ar: "e.g. Mobile number - WhatsApp - Instagram - Website",
            en: "e.g. Mobile number - WhatsApp - Instagram - Website",
          },
        },
        {
          type: "textarea",
          question: "The Text of Visual?",
          required: true,
          placeholder: "e.g. عرض الـ 50% خلال 10 أيام",
          questionI18n: {
            ar: "ما هو النص على التصميم",
            en: "The Text of Visual?",
          },
          placeholderI18n: {
            ar: "e.g. عرض الـ 50% خلال 10 أيام",
            en: "e.g. عرض الـ 50% خلال 10 أيام",
          },
        },
        {
          type: "file",
          maxFiles: 8,
          question: "Upload Reference for designs or styles ",
          required: false,
          maxSizeMB: 100,
          questionI18n: {
            ar: "ارفع مرجعاً للتصاميم أو الستايل ",
            en: "Upload Reference for designs or styles ",
          },
        },
      ],
    } as any,
  });

  const reelVideo = await prisma.serviceType.create({
    data: {
      name: "Reel Video (5-10 sec)",
      nameI18n: {
        ar: "ريل فيديو (5-10 ثانية)",
        en: "Reel Video (5-10 sec)",
      },
      description:
        "Short video reels for social media (5-10 seconds base, +250 credits per additional 10 seconds)",
      descriptionI18n: {
        ar: "ريلز قصيرة لمنصات التواصل الاجتماعي (5-10 ثوان أساسي، +5 كريدت لكل 10 ثوان إضافية)",
        en: "Short video reels for social media (5-10 seconds base, +250 credits per additional 10 seconds)",
      },
      icon: "🎬",
      creditCost: 1000,
      maxFreeRevisions: 1,
      paidRevisionCost: 250,
      resetFreeRevisionsOnPaid: true,
      maxDeliveryMinutes: 480,
      isActive: true,
      sortOrder: 2,
      attributes: [
        {
          type: "select",
          options: ["0", "5 sec", "15 sec", "20 sec"],
          question: "How many additional 10-second segments?",
          required: false,
          creditImpact: 5,
          questionI18n: {
            ar: "كم عدد المقاطع الإضافية (10 ثوان لكل مقطع)؟",
            en: "How many additional 10-second segments?",
          },
          optionsWithCost: [
            {
              value: "0",
              creditCost: 0,
            },
            {
              value: "5 sec",
              creditCost: 100,
            },
            {
              value: "15 sec",
              creditCost: 250,
            },
            {
              value: "20 sec",
              creditCost: 600,
            },
          ],
        },
        {
          type: "textarea",
          question: "Do you have script?",
          required: false,
          questionI18n: {
            ar: "هل لديك سكريبت؟",
            en: "Do you have script?",
          },
        },
        {
          type: "voice",
          maxFiles: 1,
          question: "Do ypu need voice over?",
          required: false,
          maxSizeMB: 100,
          questionI18n: {
            ar: "هل تحتاج تعليق صوتي؟",
            en: "Do ypu need voice over?",
          },
        },
        {
          type: "file",
          maxFiles: 8,
          question: "Upload your Logo or Brand Identity Guideline  ",
          required: true,
          maxSizeMB: 100,
          questionI18n: {
            ar: "قم برفع اللوجو أو ملف الهوية البصرية",
            en: "Upload your Logo or Brand Identity Guideline  ",
          },
        },
        {
          type: "text",
          question: "Who is the Target Audience?",
          required: true,
          placeholder: "e.g. Youth - Families - Gen Z - Women",
          questionI18n: {
            ar: "من هم جمهورك المستهدف؟",
            en: "Who is the Target Audience?",
          },
          placeholderI18n: {
            ar: "e.g. Youth - Families - Gen Z - Women",
            en: "e.g. Youth - Families - Gen Z - Women",
          },
        },
        {
          type: "textarea",
          question: "What is your video style?",
          required: true,
          placeholder: "e.g. Realisitc - 2D - Pixar style - ...........",
          questionI18n: {
            ar: "ما هو ستايل الفيديو؟",
            en: "What is your video style?",
          },
          placeholderI18n: {
            ar: "e.g. Realisitc - 2D - Pixar style - ...........",
            en: "e.g. Realisitc - 2D - Pixar style - ...........",
          },
        },
        {
          type: "textarea",
          question: "What is the Core message from the video?",
          required: true,
          questionI18n: {
            ar: "ما هي الرسالة الأساسية التي تريد ايصالها من خلال الفيديو؟",
            en: "What is the Core message from the video?",
          },
        },
      ],
    } as any,
  });

  const logoDesign = await prisma.serviceType.create({
    data: {
      name: "Logo Design",
      nameI18n: {
        ar: "تصميم لوجو",
        en: "Logo Design",
      },
      description: "Professional logo design for your brand",
      descriptionI18n: {
        ar: "تصميم شعار احترافي لعلامتك التجارية",
        en: "Professional logo design for your brand",
      },
      icon: "🖌️",
      creditCost: 1000,
      maxFreeRevisions: 1,
      paidRevisionCost: 250,
      resetFreeRevisionsOnPaid: true,
      maxDeliveryMinutes: 480,
      isActive: true,
      sortOrder: 3,
      attributes: [
        {
          type: "text",
          question: "How would you describe your brand's personality?",
          required: true,
          placeholder: "e.g. Formal - Friendly - Bold - Calm - Youthful - Luxurious",
          questionI18n: {
            ar: "كيف تصف شخصية علامتك التجارية؟",
            en: "How would you describe your brand's personality?",
          },
          placeholderI18n: {
            ar: "رسمية - ودودة - جريئة - هادئة - شبابية - فاخرة",
            en: "e.g. Formal - Friendly - Bold - Calm - Youthful - Luxurious",
          },
        },
        {
          type: "text",
          question: "Do you have any colors you prefer to use or avoid?",
          required: true,
          questionI18n: {
            ar: "هل لديك ألوان تفضل استخدامها أو تجنبها؟",
            en: "Do you have any colors you prefer to use or avoid?",
          },
        },
      ],
    } as any,
  });

  const voiceOver = await prisma.serviceType.create({
    data: {
      name: "Voice Over",
      nameI18n: {
        ar: "أداء صوتي (عربي)",
        en: "Voice Over",
      },
      description: "Professional Arabic and English voice over for videos",
      descriptionI18n: {
        ar: "أداء صوتي احترافي باللغة العربية للفيديوهات",
        en: "Professional Arabic and English voice over for videos",
      },
      icon: "🎵",
      creditCost: 250,
      maxFreeRevisions: 1,
      paidRevisionCost: 84,
      resetFreeRevisionsOnPaid: true,
      maxDeliveryMinutes: 480,
      isActive: true,
      sortOrder: 4,
      attributes: [
        {
          type: "text",
          helpText: "e.g. enthusiasm - formal - luxury tone ",
          question: "What is the Tone of Voice?",
          required: true,
          helpTextI18n: {
            ar: "مثال: حماسي - فورمال - فاخر",
            en: "e.g. enthusiasm - formal - luxury tone ",
          },
          questionI18n: {
            ar: "ما هي نبرة الصوت؟",
            en: "What is the Tone of Voice?",
          },
        },
        {
          type: "textarea",
          question: "Drop your script ",
          required: true,
          questionI18n: {
            ar: "اكتب السكريبت",
            en: "Drop your script ",
          },
        },
        {
          type: "textarea",
          question: "Language and Dialect?",
          required: true,
          questionI18n: {
            ar: "اللغة و اللهجة؟",
            en: "Language and Dialect?",
          },
        },
      ],
    } as any,
  });

  const businessPresentation = await prisma.serviceType.create({
    data: {
      name: "business Presentation",
      nameI18n: {
        ar: "عرض تقديمي للشركات",
        en: "business Presentation",
      },
      description: "business Presentation",
      descriptionI18n: {
        ar: "عرض تقديمي للاعمال",
        en: "business Presentation",
      },
      icon: "💼",
      creditCost: 1000,
      maxFreeRevisions: 1,
      paidRevisionCost: 250,
      resetFreeRevisionsOnPaid: true,
      maxDeliveryMinutes: 480,
      isActive: true,
      sortOrder: 5,
      attributes: [
        {
          min: 1,
          type: "number",
          question: "Total number of pages",
          required: true,
          creditImpact: 1,
          questionI18n: {
            ar: "إجمالي عدد الصفحات ",
            en: "Total number of pages",
          },
          includedQuantity: 20,
        },
      ],
    } as any,
  });

  const animation2D = await prisma.serviceType.create({
    data: {
      name: "2D Animation Video",
      nameI18n: {
        ar: "فيديو انيميشن 2D",
        en: "2D Animation Video",
      },
      description:
        "2D animation video (1,000 credits for the first 10 seconds; +500 credits for every additional 10 seconds))",
      descriptionI18n: {
        ar: "فيديو انيميشن 2D (1000 كريدت لأول 10 ثوان، +500 كريدت لكل 10 ثوان إضافية)",
        en: "2D animation video (1,000 credits for the first 10 seconds; +500 credits for every additional 10 seconds))",
      },
      icon: "🎬",
      creditCost: 1000,
      maxFreeRevisions: 1,
      paidRevisionCost: 2,
      resetFreeRevisionsOnPaid: true,
      maxDeliveryMinutes: 480,
      isActive: true,
      sortOrder: 6,
      attributes: [
        {
          type: "select",
          options: ["0", "1", "2", "3", "4", "5", "", ""],
          question: "How many additional 10-second segments?",
          required: false,
          creditImpact: 10,
          questionI18n: {
            ar: "كم عدد المقاطع الإضافية (10 ثوان لكل مقطع)؟",
            en: "How many additional 10-second segments?",
          },
          optionsWithCost: [
            {
              value: "0",
              creditCost: 10,
            },
            {
              value: "1",
              creditCost: 10,
            },
            {
              value: "2",
              creditCost: 10,
            },
            {
              value: "3",
              creditCost: 10,
            },
            {
              value: "4",
              creditCost: 10,
            },
            {
              value: "5",
              creditCost: 10,
            },
            {
              value: "",
              creditCost: 0,
            },
            {
              value: "",
              creditCost: 0,
            },
          ],
        },
        {
          type: "textarea",
          question: "Who is your Target Audience?",
          required: true,
          questionI18n: {
            ar: "من هو الجمهور المستهدف؟",
            en: "Who is your Target Audience?",
          },
        },
        {
          type: "file",
          maxFiles: 8,
          question: "Upload your logo or Brand guideline ",
          required: true,
          maxSizeMB: 100,
          questionI18n: {
            ar: "قم برفع اللوجو أو ملف الهوية",
            en: "Upload your logo or Brand guideline ",
          },
        },
        {
          type: "textarea",
          question: "Do you need Voice over?",
          required: false,
          placeholder: "If yes, drop your script",
          questionI18n: {
            ar: "هل تحتاج إلى تعليق صوتي؟",
            en: "Do you need Voice over?",
          },
          placeholderI18n: {
            ar: "إذا كانت الإجابة بنعم، يرجى تزويدنا بالسكريبت",
            en: "If yes, drop your script",
          },
        },
      ],
    } as any,
  });

  const animation3D = await prisma.serviceType.create({
    data: {
      name: "3D Animation Video",
      nameI18n: {
        ar: "فيديو انيميشن 3D",
        en: "3D Animation Video",
      },
      description:
        "3D animation video (1,500 credits for the first 10 seconds; +1,000 credits for every additional 10 seconds)",
      descriptionI18n: {
        ar: "فيديو انيميشن 3D (1500 كريدت لأول 10 ثوان، +1000 كريدت لكل 10 ثوان إضافية)",
        en: "3D animation video (1,500 credits for the first 10 seconds; +1,000 credits for every additional 10 seconds)",
      },
      icon: "🎬",
      creditCost: 1500,
      maxFreeRevisions: 1,
      paidRevisionCost: 2,
      resetFreeRevisionsOnPaid: true,
      maxDeliveryMinutes: 480,
      isActive: true,
      sortOrder: 7,
      attributes: [
        {
          type: "select",
          options: ["0", "1", "2", "3", "4", "5", ""],
          question: "How many additional 10-second segments?",
          required: false,
          creditImpact: 15,
          questionI18n: {
            ar: "كم عدد المقاطع الإضافية (10 ثوان لكل مقطع)؟",
            en: "How many additional 10-second segments?",
          },
          optionsWithCost: [
            {
              value: "0",
              creditCost: 15,
            },
            {
              value: "1",
              creditCost: 15,
            },
            {
              value: "2",
              creditCost: 15,
            },
            {
              value: "3",
              creditCost: 15,
            },
            {
              value: "4",
              creditCost: 15,
            },
            {
              value: "5",
              creditCost: 15,
            },
            {
              value: "",
              creditCost: 0,
            },
          ],
        },
        {
          type: "textarea",
          question: "Do You need voice over?",
          required: true,
          placeholder: "If yes, drop your script",
          questionI18n: {
            ar: "هل تحتاج إلى تعليق صوتي؟",
            en: "Do You need voice over?",
          },
          placeholderI18n: {
            ar: "إذا كانت الإجابة بنعم، يرجى تزويدنا بالسكريبت",
            en: "If yes, drop your script",
          },
        },
        {
          type: "file",
          maxFiles: 8,
          question: "Upload your logo or Brand guideline ",
          required: true,
          maxSizeMB: 100,
          questionI18n: {
            ar: "قم برفع اللوجو أو ملف الهوية ",
            en: "Upload your logo or Brand guideline ",
          },
        },
        {
          type: "text",
          question: "who is your Taregt Audience?",
          required: true,
          questionI18n: {
            ar: "من هو جمهورك المستهدف؟",
            en: "who is your Taregt Audience?",
          },
        },
      ],
    } as any,
  });

  console.log("🎨 Created 7 service types");

  // ─── Packages (from wengz.tech) ───────────────────────────────────────────

  const freePackage = await prisma.package.create({
    data: {
      name: "Free Plan",
      nameI18n: {
        en: "Free Plan",
        ar: "الخطة المجانية",
      },
      description: "Basic free plan for all new users with 500 credits valid for 14 days",
      descriptionI18n: {
        en: "Basic free plan for all new users with 500 credits valid for 14 days",
        ar: "خطة مجانية أساسية لجميع المستخدمين الجدد مع 500 كريدت صالحة لمدة 14 يومًا",
      },
      features: [],
      price: 0,
      credits: 500,
      durationDays: 14,
      isActive: true,
      isFreePackage: true,
      isFeatured: false,
      supportAllServices: true,
      sortOrder: 0,
    } as any,
  });
  console.log(
    "📦",
    freePackage.name,
    `(${freePackage.credits} cr / ${freePackage.price} / ${freePackage.durationDays}d)`
  );

  const package1 = await prisma.package.create({
    data: {
      name: "Basic Package - 5000 Credits",
      nameI18n: {
        ar: "الباقة الأولى - 5000 كريدت",
        en: "Basic Package - 5000 Credits",
      },
      description:
        "Includes social media designs and reels. Suitable for small businesses and retail stores.",
      descriptionI18n: {
        ar: "تشمل تصميمات لمنصات التواصل الاجتماعي وريلز. مناسبة للشركات الصغيرة والمحلات التجارية.",
        en: "Includes social media designs and reels. Suitable for small businesses and retail stores.",
      },
      features: [
        "Social media designs (500 credits per design)",
        "Reels: 1,000 credits per 10 seconds (500–1,000 additional credits for each extra 10 seconds)",
        "First revision is free, then 250 credits per additional revision",
        "Voice-over available (+250 credits)",
      ],
      featuresI18n: {
        ar: [
          "تصميمات لمنصات التواصل الاجتماعي (500 كريدت لكل تصميم)",
          "ريلز  1000 كرديت لكل 10 ثواني  500 الى 1000 كرديت  لكل 10 ثوان إضافية)",
          "التعديل الأول مجاني، 250 كريدت بعد ذلك",
          "أداء صوتي متاح (+250 كريدت)",
        ],
        en: [
          "Social media designs (500 credits per design)",
          "Reels: 1,000 credits per 10 seconds (500–1,000 additional credits for each extra 10 seconds)",
          "First revision is free, then 250 credits per additional revision",
          "Voice-over available (+250 credits)",
        ],
      },
      price: 40,
      credits: 5000,
      durationDays: 30,
      isActive: true,
      isFreePackage: false,
      isFeatured: false,
      supportAllServices: false,
      sortOrder: 1,
    } as any,
  });
  await prisma.packageService.createMany({
    data: [
      { packageId: package1.id, serviceId: socialMediaDesign.id },
      { packageId: package1.id, serviceId: reelVideo.id },
      { packageId: package1.id, serviceId: voiceOver.id },
      { packageId: package1.id, serviceId: logoDesign.id },
      { packageId: package1.id, serviceId: businessPresentation.id },
      { packageId: package1.id, serviceId: animation2D.id },
      { packageId: package1.id, serviceId: animation3D.id },
    ],
  });
  console.log(
    "📦",
    package1.name,
    `(${package1.credits} cr / ${package1.price} / ${package1.durationDays}d)`
  );

  const package2 = await prisma.package.create({
    data: {
      name: "Standard Package - 10.000 Credits",
      nameI18n: {
        ar: "الباقة الثانية - 10.000 كريدت",
        en: "Standard Package - 10.000 Credits",
      },
      description:
        "Includes designs, reels, and logo. Suitable for small businesses and e-commerce.",
      descriptionI18n: {
        ar: "تشمل التصميمات والريلز واللوجو. مناسبة للشركات الصغيرة والتجارة الإلكترونية.",
        en: "Includes designs, reels, and logo. Suitable for small businesses and e-commerce.",
      },
      features: [
        "Social media designs (500 credits per design)",
        "Reels: 1,000 credits per 10 seconds (500–1,000 additional credits for each extra 10 seconds)",
        "First revision is free, then 250 credits per additional revision",
        "Voice-over available (+250 credits)",
        "Logo design (1,000 credits)",
        "First revision is free, then 250 credits per additional revision",
      ],
      featuresI18n: {
        ar: [
          "تصميمات لمنصات التواصل الاجتماعي (500 كريدت لكل تصميم)",
          "ريلز  1000 كرديت لكل 10 ثواني  500 الى 1000 كرديت  لكل 10 ثوان إضافية)",
          "التعديل الأول مجاني، 250 كريدت بعد ذلك",
          "أداء صوتي متاح (+250 كريدت)",
          "تصميم لوجو (1000 كريدت)",
          "التعديل الأول مجاني، 250 كريدت بعد ذلك",
        ],
        en: [
          "Social media designs (500 credits per design)",
          "Reels: 1,000 credits per 10 seconds (500–1,000 additional credits for each extra 10 seconds)",
          "First revision is free, then 250 credits per additional revision",
          "Voice-over available (+250 credits)",
          "Logo design (1,000 credits)",
          "First revision is free, then 250 credits per additional revision",
        ],
      },
      price: 80,
      credits: 10000,
      durationDays: 30,
      isActive: true,
      isFreePackage: false,
      isFeatured: true,
      supportAllServices: true,
      sortOrder: 2,
    } as any,
  });
  await prisma.packageService.createMany({
    data: [
      { packageId: package2.id, serviceId: socialMediaDesign.id },
      { packageId: package2.id, serviceId: reelVideo.id },
      { packageId: package2.id, serviceId: logoDesign.id },
      { packageId: package2.id, serviceId: voiceOver.id },
    ],
  });
  console.log(
    "📦",
    package2.name,
    `(${package2.credits} cr / ${package2.price} / ${package2.durationDays}d)`
  );

  const package3 = await prisma.package.create({
    data: {
      name: "Premium Package - 20.000 Credits",
      nameI18n: {
        ar: "الباقة الثالثة - 20.000 كريدت",
        en: "Premium Package - 20.000 Credits",
      },
      description:
        "Includes designs, Reels, logos, and corporate presentations. Suitable for cafes, restaurants, and medium-sized businesses.",
      descriptionI18n: {
        ar: 'تشمل التصاميم، ومقاطع "الريلز" (Reels)، والشعارات، والعروض التقديمية للشركات. مناسبة للمقاهي والمطاعم والشركات المتوسطة.',
        en: "Includes designs, Reels, logos, and corporate presentations. Suitable for cafes, restaurants, and medium-sized businesses.",
      },
      features: [
        "Social media designs (500 credits per design)",
        "Reels: 1,000 credits per 10 seconds (500–1,000 credits per additional 10 seconds)",
        "First revision free; 250 credits thereafter",
        "Voiceover available (+250 credits)",
        "Logo design (1,000 credits)",
        "Corporate presentation: 2,500 credits per 5 pages (+250 credits per additional page)",
        "First revision free; +250 credits thereafter",
      ],
      featuresI18n: {
        ar: [
          "تصميمات لمنصات التواصل الاجتماعي (500 كريدت لكل تصميم)",
          "ريلز  1000 كرديت لكل 10 ثواني  500 الى 1000 كرديت  لكل 10 ثوان إضافية)",
          "التعديل الأول مجاني، 250 كريدت بعد ذلك",
          "أداء صوتي متاح (+250 كريدت)",
          "تصميم لوجو (1000 كريدت)",
          "العرض التقديمي للشركات لكل 5 صفحات( 2500 كرديت )لكل صفحة زياده +250 كرديت",
          "التعديل الأول مجاني، + 250 كريدت بعد ذلك",
        ],
        en: [
          "Social media designs (500 credits per design)",
          "Reels: 1,000 credits per 10 seconds (500–1,000 credits per additional 10 seconds)",
          "First revision free; 250 credits thereafter",
          "Voiceover available (+250 credits)",
          "Logo design (1,000 credits)",
          "Corporate presentation: 2,500 credits per 5 pages (+250 credits per additional page)",
          "First revision free; +250 credits thereafter",
        ],
      },
      price: 160,
      credits: 20000,
      durationDays: 30,
      isActive: true,
      isFreePackage: false,
      isFeatured: false,
      supportAllServices: true,
      sortOrder: 3,
    } as any,
  });
  await prisma.packageService.createMany({
    data: [
      { packageId: package3.id, serviceId: socialMediaDesign.id },
      { packageId: package3.id, serviceId: reelVideo.id },
      { packageId: package3.id, serviceId: logoDesign.id },
      { packageId: package3.id, serviceId: businessPresentation.id },
      { packageId: package3.id, serviceId: voiceOver.id },
    ],
  });
  console.log(
    "📦",
    package3.name,
    `(${package3.credits} cr / ${package3.price} / ${package3.durationDays}d)`
  );

  const package4 = await prisma.package.create({
    data: {
      name: "Package 4 - Unlimited",
      nameI18n: {
        ar: "الباقة الرابعة - بلا حدود",
        en: "Package 4 - Unlimited",
      },
      description:
        "All services included: designs, reels, logo, digital menu, and 2D/3D animations. Suitable for large companies.",
      descriptionI18n: {
        ar: "جميع الخدمات مشمولة: التصميمات والريلز واللوجو والمنيو الرقمي وفيديوهات 2D/3D. مناسبة للشركات الكبيرة.",
        en: "All services included: designs, reels, logo, digital menu, and 2D/3D animations. Suitable for large companies.",
      },
      features: [
        "Social media designs (5 credits each)",
        "Reels 5-10 seconds (10 credits, +5 per extra 10 sec)",
        "Logo design (50 credits)",
        "Digital QR Menu (50 credits for 20 products, +1 per extra)",
        "2D Animation (20 credits for 10 sec, +10 per extra 10 sec)",
        "3D Animation (40 credits for 10 sec, +15 per extra 10 sec)",
        "Voice over available (+5 credits)",
        "First revision free, 2 credits after",
      ],
      featuresI18n: {
        ar: [
          "تصميمات لمنصات التواصل الاجتماعي (5 كريدت لكل تصميم)",
          "ريلز 5-10 ثوان (10 كريدت، +5 لكل 10 ثوان إضافية)",
          "تصميم لوجو (50 كريدت)",
          "منيو QR ديجيتال (50 كريدت لـ20 منتج، +1 لكل منتج إضافي)",
          "فيديو انيميشن 2D (20 كريدت لـ10 ثوان، +10 لكل 10 ثوان إضافية)",
          "فيديو انيميشن 3D (40 كريدت لـ10 ثوان، +15 لكل 10 ثوان إضافية)",
          "أداء صوتي متاح (+5 كريدت)",
          "التعديل الأول مجاني، 2 كريدت بعد ذلك",
        ],
        en: [
          "Social media designs (5 credits each)",
          "Reels 5-10 seconds (10 credits, +5 per extra 10 sec)",
          "Logo design (50 credits)",
          "Digital QR Menu (50 credits for 20 products, +1 per extra)",
          "2D Animation (20 credits for 10 sec, +10 per extra 10 sec)",
          "3D Animation (40 credits for 10 sec, +15 per extra 10 sec)",
          "Voice over available (+5 credits)",
          "First revision free, 2 credits after",
        ],
      },
      price: 500,
      credits: 45,
      durationDays: 30,
      isActive: false,
      isFreePackage: false,
      isFeatured: false,
      supportAllServices: true,
      sortOrder: 4,
    } as any,
  });
  await prisma.packageService.createMany({
    data: [
      { packageId: package4.id, serviceId: socialMediaDesign.id },
      { packageId: package4.id, serviceId: reelVideo.id },
      { packageId: package4.id, serviceId: logoDesign.id },
      { packageId: package4.id, serviceId: businessPresentation.id },
      { packageId: package4.id, serviceId: animation2D.id },
      { packageId: package4.id, serviceId: animation3D.id },
      { packageId: package4.id, serviceId: voiceOver.id },
    ],
  });
  console.log(
    "📦",
    package4.name,
    `(${package4.credits} cr / ${package4.price} / ${package4.durationDays}d)`
  );

  // ─── Dashboard / system settings (from wengz.tech) ───────────────────────

  await prisma.systemSettings.createMany({
    data: [
      {
        key: "credit_price_usd",
        value: { amount: 0.008 },
        description: "Global USD value of one credit for provider settlement.",
      },
      {
        key: "provider_commission_percent",
        value: { percent: 0 },
        description: "Platform commission percent taken from provider settlement.",
      },
      {
        key: "min_withdrawal_usd",
        value: { amount: 1 },
        description: "Minimum USD amount a provider may request to withdraw.",
      },
      {
        key: "withdrawal_fee_usd",
        value: { amount: 0 },
        description:
          "Fixed USD fee deducted from provider withdrawals (net payout = amount − fee).",
      },
      {
        key: "payment_instructions",
        value: {
          bankName: "National Bank of Kuwait",
          accountName: "NABRA E BUSINESS SOLUTIONS",
          iban: "EG490023002302302617611610010",
          swiftCode: "WABAEGCXXXX",
          currency: "USD",
          note: "Please include your email address in the transfer reference for faster verification.",
          instapayEnabled: true,
          instapayLink: "https://ipn.eg/S/alaa.elsayed6355/instapay/0ee8nl",
        },
        description: "Manual client payment instructions (bank transfer + InstaPay).",
      },
      {
        key: "maintenance_mode",
        value: { enabled: false },
        description: "When enabled, only SUPER_ADMIN users can log in.",
      },
    ],
  });

  console.log("⚙️  Seeded finance, payment, and maintenance settings");
  console.log(`   creditPriceUsd=0.008 commission=0% minWithdrawal=1 withdrawalFee=0`);

  // ─── Sample users (all roles) — local/demo only ────────────────────────────
  const demoPasswordPlain = process.env.SEED_DEMO_PASSWORD || "SeedDemo!ChangeMe123";
  const hashedDemoPassword = await bcrypt.hash(demoPasswordPlain, 12);
  const approvedAt = new Date();

  const projectManager = await prisma.user.create({
    data: {
      name: "Sample Project Manager",
      email: "pm@wengz.tech",
      password: hashedDemoPassword,
      role: "PROJECT_MANAGER",
      approvalStatus: "APPROVED",
      approvedAt,
      emailVerified: approvedAt,
    },
  });

  const financeManager = await prisma.user.create({
    data: {
      name: "Sample Finance Manager",
      email: "finance@wengz.tech",
      password: hashedDemoPassword,
      role: "FINANCE_MANAGER",
      approvalStatus: "APPROVED",
      approvedAt,
      emailVerified: approvedAt,
    },
  });

  const client = await prisma.user.create({
    data: {
      name: "Sample Client",
      email: "client@wengz.tech",
      password: hashedDemoPassword,
      role: "CLIENT",
      approvalStatus: "APPROVED",
      approvedAt,
      emailVerified: approvedAt,
      phone: "+201000000001",
    },
  });

  const freeSubEnd = new Date(Date.now() + freePackage.durationDays * 24 * 60 * 60 * 1000);
  await prisma.clientSubscription.create({
    data: {
      userId: client.id,
      packageId: freePackage.id,
      remainingCredits: freePackage.credits,
      startDate: approvedAt,
      endDate: freeSubEnd,
      isActive: true,
      isFreeTrialUsed: true,
    },
  });

  const provider = await prisma.user.create({
    data: {
      name: "Sample Provider",
      email: "provider@wengz.tech",
      password: hashedDemoPassword,
      role: "PROVIDER",
      approvalStatus: "APPROVED",
      approvedAt,
      emailVerified: approvedAt,
      phone: "+201000000002",
      providerProfile: {
        create: {
          bio: "Seeded demo provider — supports all active services.",
          portfolio: "https://wengz.tech",
          skillsTags: ["design", "video", "voice"],
          isActive: true,
          supportedServices: {
            connect: [
              { id: socialMediaDesign.id },
              { id: reelVideo.id },
              { id: logoDesign.id },
              { id: voiceOver.id },
              { id: businessPresentation.id },
              { id: animation2D.id },
              { id: animation3D.id },
            ],
          },
        },
      },
      providerWallet: {
        create: {},
      },
    },
  });

  console.log("👥 Seeded sample users for all roles");

  const adminPasswordHint = adminPassword ? "<SEED_ADMIN_PASSWORD>" : "DevOnly!ChangeMe123";

  console.log("\n✅ Seed completed successfully!");
  console.log("\n" + "═".repeat(56));
  console.log("🔑 Login credentials (seeded)");
  console.log("═".repeat(56));
  console.log(`SUPER_ADMIN       nabraagency20@gmail.com / ${adminPasswordHint}`);
  console.log(`PROJECT_MANAGER   ${projectManager.email} / ${demoPasswordPlain}`);
  console.log(`FINANCE_MANAGER   ${financeManager.email} / ${demoPasswordPlain}`);
  console.log(`CLIENT            ${client.email} / ${demoPasswordPlain}`);
  console.log(`PROVIDER          ${provider.email} / ${demoPasswordPlain}`);
  console.log("═".repeat(56));
  console.log("(Override demo password with SEED_DEMO_PASSWORD; admin with SEED_ADMIN_PASSWORD)");
  console.log("\n📦 Free Plan: 500 credits / 14 days / $0");
  console.log(
    "📦 Basic: 5,000 cr / $40 | Standard: 10,000 cr / $80 (featured) | Premium: 20,000 cr / $160"
  );
  console.log("📦 Package 4 Unlimited: 45 cr / $500 [inactive]");
  console.log("💵 Finance: $0.008/credit, 0% commission");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
