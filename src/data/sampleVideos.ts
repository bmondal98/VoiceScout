import type { LanguageOption, ProcessingLanguageOption /*, VideoOption, AskResponse, TargetLanguage */ } from '../types';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'hi',
    label: 'Hindi',
    nativeLabel: 'हिन्दी',
    flag: '🇮🇳',
    speechCode: 'hi-IN',
  },
  {
    code: 'mr',
    label: 'Marathi',
    nativeLabel: 'मराठी',
    flag: '🚩',
    speechCode: 'mr-IN',
  },
  {
    code: 'bn',
    label: 'Bengali',
    nativeLabel: 'বাংলা',
    flag: '🇧🇩',
    speechCode: 'bn-IN',
  },
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    flag: '🌐',
    speechCode: 'en-US',
  },
];

// Language choices offered when submitting a pasted YouTube URL for backend processing
export const PROCESSING_LANGUAGES: ProcessingLanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'hi', label: 'Hindi' },
  { code: 'fil', label: 'Filipino' },
];

// export const SAMPLE_VIDEOS: VideoOption[] = [
//   {
//     id: 'vid_py_01',
//     youtubeId: 'kqtD5dpn9C8',
//     title: 'Python Memory & Loops',
//     originalLanguage: 'English (EN)',
//     instructor: 'Corey Schafer',
//     duration: '10:08',
//     description: 'Deep dive into Python variables, memory allocation, list iteration, and break/continue statements.',
//     badge: 'Video A',
//     chapters: [
//       { title: 'For Loops & Range', seconds: 45, formattedTime: '00:45' },
//       { title: 'Break & Continue in Memory', seconds: 152, formattedTime: '02:32' },
//       { title: 'Nested Loops & Efficiency', seconds: 280, formattedTime: '04:40' },
//       { title: 'While Loops & Mutability', seconds: 410, formattedTime: '06:50' },
//     ],
//     sampleQuestions: [
//       'How does break differ from continue in memory?',
//       'How does Python store loop variables in memory?',
//       'What happens when using while loops with lists?',
//     ],
//   },
//   {
//     id: 'vid_fr_02',
//     youtubeId: 'aircAruvnKk',
//     title: 'Deep Learning Fundamentals',
//     originalLanguage: 'French (FR)',
//     instructor: '3Blue1Brown (FR Dub)',
//     duration: '19:12',
//     description: 'Comprendre les réseaux de neurones, la rétropropagation du gradient et les fonctions d\'activation.',
//     badge: 'Video B',
//     chapters: [
//       { title: 'Neural Structure (Structure Neurones)', seconds: 60, formattedTime: '01:00' },
//       { title: 'Weights & Biases (Poids et Biais)', seconds: 215, formattedTime: '03:35' },
//       { title: 'Activation Functions (Fonction Sigmoïde)', seconds: 430, formattedTime: '07:10' },
//       { title: 'Cost Function & Loss (Fonction de Coût)', seconds: 650, formattedTime: '10:50' },
//     ],
//     sampleQuestions: [
//       'Comment fonctionne la fonction de coût ?',
//       'What are weights and biases in neural layers?',
//       'How does gradient descent minimize error?',
//     ],
//   },
// ];

/*
// Rich fallback mock answers categorized by video and target language
export const MOCK_RESPONSES: Record<string, Record<TargetLanguage, AskResponse>> = {
  vid_py_01: {
    hi: {
      transcribed_query: 'Python में break और continue लूप्स मेमोरी में कैसे काम करते हैं?',
      answer_text: 'Python में `break` स्टेटमेंट लूप को तुरंत समाप्त कर देता है और मेमोरी से लूप पॉइंटर को रिलीज कर देता है, जबकि `continue` वर्तमान इटरेशन को छोड़ कर अगले इटरेशन पर चला जाता है। वीडियो के इस हिस्से में देखें कि कैसे यह कंट्रोल फ्लो को बदलता है।',
      target_seconds: 152,
      quote: '"If you hit a break keyword, it completely breaks out of the loop... continue will just skip to the next iteration."',
      language: 'hi',
    },
    mr: {
      transcribed_query: 'पायथनमध्ये लूप व्हेरिएबल्स मेमरीमध्ये कसे सेव्ह होतात?',
      answer_text: 'पायथन लूप चालवताना व्हेरिएबलचे रेफरन्स मेमरीमध्ये ॲलोकेट करतो. `break` वापरल्यावर लूप त्वरित थांबतो, तर `continue` मुळे फक्त चालू इटरेशन स्किप होते. टाइमस्टॅम्प 02:32 वर स्पष्टीकरण पहा.',
      target_seconds: 152,
      quote: '"If you hit a break keyword, it completely breaks out of the loop... continue will just skip to the next iteration."',
      language: 'mr',
    },
    bn: {
      transcribed_query: 'পাইথনে break এবং continue স্টেটমেন্ট মেমরিতে কীভাবে কাজ করে?',
      answer_text: 'পাইথনে `break` স্টেটমেন্ট লুপকে সাথে সাথে বন্ধ করে দেয় এবং মেমরি থেকে লুপ স্টেট অবমুক্ত করে। পক্ষান্তরে `continue` বর্তমান লুপের পুনরাবৃত্তি বাদ দিয়ে পরবর্তী চক্রে যায়। ভিডিওর ২ মিনিট ৩২ সেকেন্ডে এটি বিস্তারিত দেখানো হয়েছে।',
      target_seconds: 152,
      quote: '"If you hit a break keyword, it completely breaks out of the loop... continue will just skip to the next iteration."',
      language: 'bn',
    },
    en: {
      transcribed_query: 'How does break differ from continue in loop execution and memory?',
      answer_text: 'In Python, the `break` statement immediately terminates the loop and cleans up the iterator stack frame, while `continue` aborts only the current iteration and jumps directly to evaluating the next element. The video shows this at 02:32.',
      target_seconds: 152,
      quote: '"If you hit a break keyword, it completely breaks out of the loop... continue will just skip to the next iteration."',
      language: 'en',
    },
  },
  vid_fr_02: {
    hi: {
      transcribed_query: 'न्यूरल नेटवर्क में Weights और Biases का क्या काम होता है?',
      answer_text: 'न्यूरॉन्स के बीच कनेक्शन को Weights नियंत्रित करते हैं और Bias यह तय करता है कि न्यूरॉन को एक्टिवेट करने के लिए कितना मजबूत सिग्नल चाहिए। इस वीडियो में 03:35 पर न्यूरल लेयर्स का यह कॉन्सेप्ट समझाया गया है।',
      target_seconds: 215,
      quote: '"Chaque connexion entre deux neurones a un poids associé... et un biais pour ajuster le seuil d\'activation."',
      language: 'hi',
    },
    mr: {
      transcribed_query: 'डीप लर्निंगमध्ये Weights आणि Biases ची भूमिका काय असते?',
      answer_text: 'न्यूरल नेटवर्कमध्ये वेट्स (Weights) कनेक्शनची तीव्रता ठरवतात आणि बायसेस (Biases) न्यूरॉनला योग्य वेळी फायर करण्यासाठी थ्रेशोल्ड ॲडजस्ट करतात. 03:35 टाइमस्टॅम्पवर न्यूरॉन ॲक्टिव्हेशनचे स्पष्टीकरण पहा.',
      target_seconds: 215,
      quote: '"Chaque connexion entre deux neurones a un poids associé... et un biais pour ajuster le seuil d\'activation."',
      language: 'mr',
    },
    bn: {
      transcribed_query: 'ডিপ লার্নিংয়ে Weights এবং Biases কীভাবে নিউরন নিয়ন্ত্রণ করে?',
      answer_text: 'নিউরাল নেটওয়ার্কে ওয়েটস ইনপুট সিগন্যালের গুরুত্ব নির্ধারণ করে এবং বায়াস নিউরন সক্রিয় করার মাত্রা নিয়ন্ত্রণ করে। ৩ মিনিট ৩৫ সেকেন্ডে এটি গ্রাফিক্যাল ভাবে চিত্রিত করা হয়েছে।',
      target_seconds: 215,
      quote: '"Chaque connexion entre deux neurones a un poids associé... et un biais pour ajuster le seuil d\'activation."',
      language: 'bn',
    },
    en: {
      transcribed_query: 'What is the role of weights and biases in neural activation?',
      answer_text: 'Weights determine the strength of connections between consecutive neural layers, while biases define the baseline activation threshold before non-linear functions apply. Jump to 03:35 in the video to see the layer calculation breakdown.',
      target_seconds: 215,
      quote: '"Chaque connexion entre deux neurones a un poids associé... et un biais pour ajuster le seuil d\'activation."',
      language: 'en',
    },
  },
};
*/
