# Sakib Hasan Chat & Calls - Vercel & Android Deployment Guide

## ১. Vercel-এ ডিপ্লয় করার নিয়ম (How to Deploy to Vercel)

এই প্রজেক্টটি Vercel-এ ১০০% কার্যকরভাবে চলার জন্য প্রস্তুত করা হয়েছে (`vercel.json` এবং Firebase Real-time Dual Signaling অন্তর্ভুক্ত)।

### পদ্ধতি ১: GitHub + Vercel Dashboard (সবচেয়ে সহজ)
1. সম্পূর্ণ প্রজেক্টটি আপনার GitHub রিপোজিটরিতে `push` করুন।
2. [vercel.com](https://vercel.com)-এ যান এবং আপনার GitHub অ্যাকাউন্ট দিয়ে লগইন করুন।
3. **"Add New Project"** ক্লিক করে এই রিপোজিটরিটি সিলেক্ট করুন।
4. Settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables**:
   - `GEMINI_API_KEY`: আপনার Gemini API Key যোগ করুন (ফটো এডিটর OGGy-এর জন্য)।
6. **Deploy** বাটনে ক্লিক করুন! কয়েক সেকেন্ডের মধ্যে আপনার লাইভ Vercel URL তৈরি হয়ে যাবে (যেমন: `https://sakib-chat.vercel.app`).

### পদ্ধতি ২: Vercel CLI দিয়ে সরাসরি টার্মিনাল থেকে ডিপ্লয়:
```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## ২. অ্যান্ড্রয়েড অ্যাপ (Android App / WebAPK)

এই অ্যাপটিতে আধুনিক PWA (Progressive Web App) এবং WebAPK আর্কিটেকচার সেটআপ করা আছে।

### মোবাইল ব্রাউজার থেকে সরাসরি ইনস্টল:
1. আপনার অ্যান্ড্রয়েড মোবাইলে Google Chrome দিয়ে লাইভ লিঙ্কটি ওপেন করুন।
2. স্ক্রিনের নিচে থাকা **"Install on Android"** বাটনে ট্যাপ করুন।
   (অথবা Chrome মেনু `⋮` থেকে **Install App** বা **Add to Home screen** চাপুন)।
3. আপনার ফোনে **"Sakib Chat"** নামে একটি স্বতন্ত্র নেটিভ অ্যান্ড্রয়েড অ্যাপ ইনস্টল হয়ে যাবে।
4. এতে কোনো ব্রাউজার ইউআরএল বার থাকবে না, ফুল-স্ক্রিন মোডে নেটিভ অ্যাপের মতো চলবে।

### গুগল প্লে স্টোর ও অফিশিয়াল `.apk` ফাইল তৈরি (PWABuilder):
আপনি যদি অফিশিয়াল `.apk` বা `.aab` ফাইল তৈরি করতে চান:
1. [PWABuilder.com](https://www.pwabuilder.com)-এ যান।
2. আপনার Vercel অ্যাপের URL দিন (যেমন: `https://your-app.vercel.app`) এবং **Start** চাপুন।
3. **PWA Capabilities**: আমাদের কোডে সব আইকন (192px, 512px, Maskable), Service Worker এবং Manifest ১০০% পাস করবে।
4. **Package for Android** বাটনে ক্লিক করে **Download APK** অথবা **Google Play Package (AAB)** ডাউনলোড করে নিন!

---

## ৩. WebRTC কলিং ও ভয়েস মেসেজের কার্যকারিতা (Voice & Video Calls 100%)
- **ভিডিও ও অডিও কল**: Vercel-এ কোনো স্ট্যাটফুল WebSocket সার্ভার না থাকলেও Firebase Firestore-এর মাধ্যমে রিয়েল-টাইম WebRTC সিগন্যালিং স্বয়ংক্রিয়ভাবে কাজ করবে।
- **ভয়েস নোট ও মিডিয়া**: ভয়েস নোট রেকর্ড করার পর তা হাই-ফিডেলিটি অডিও হিসেবে ট্রান্সমিট হয় এবং সার্ভারহীন Vercel পরিবেশেও কোনো সমস্যা ছাড়াই তাৎক্ষণিকভাবে প্লে হয়।
- **STUN ক্লাস্টার**: 4G/5G মোবাইল নেটওয়ার্ক এবং ওয়াইফাই-এর মাঝে নির্বিঘ্ন পিয়ার-টু-পিয়ার কানেকশনের জন্য গুগল ও ক্লাউডফ্লেয়ারের গ্লোবাল STUN সার্ভার যুক্ত রয়েছে।
