/**
 * Bazadagi User modeliga mos keladigan asosiy foydalanuvchi interfeysi.
 * Parol hash'i kabi maxfiy maydonlar bu yerda YO'Q — bu klientga qaytariladigan shakl.
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ro'yxatdan o'tish/kirish so'rovlaridan keyin API qaytaradigan xavfsiz foydalanuvchi obyekti.
 */
export interface PublicUser extends User {}