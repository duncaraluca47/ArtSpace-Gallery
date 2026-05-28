import type { ArtworkDraft } from "../state/artworksStore";

export type ArtworkFormValues = {
  title: string;
  artist: string;
  year: string;
  price: string;
  category: string;
  description: string;
  imageUrl: string;
};

export type LoginFormValues = {
  email: string;
  password: string;
};

export type RegisterFormValues = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type ValidationErrors<T extends string> = Partial<Record<T, string>>;

const currentYear = new Date().getFullYear();

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateArtworkForm(
  values: ArtworkFormValues,
): ValidationErrors<keyof ArtworkFormValues> {
  const errors: ValidationErrors<keyof ArtworkFormValues> = {};

  if (!values.title.trim()) {
    errors.title = "Title is required.";
  }

  if (!values.artist.trim()) {
    errors.artist = "Artist is required.";
  }

  const year = Number(values.year);
  if (!Number.isInteger(year)) {
    errors.year = "Year must be a valid integer.";
  } else if (year < 1000 || year > currentYear + 1) {
    errors.year = `Year must be between 1000 and ${currentYear + 1}.`;
  }

  const price = Number(values.price);
  if (!Number.isFinite(price)) {
    errors.price = "Price must be a valid number.";
  } else if (price <= 0) {
    errors.price = "Price must be greater than 0.";
  } else if (price > 100000) {
    errors.price = "Price must not exceed 100000.";
  }

  if (!values.category.trim()) {
    errors.category = "Category is required.";
  }

  if (!values.description.trim()) {
    errors.description = "Description is required.";
  } else if (values.description.trim().length < 20) {
    errors.description = "Description must be at least 20 characters.";
  }

  if (!values.imageUrl.trim()) {
    errors.imageUrl = "Image URL is required.";
  } else if (!isValidHttpUrl(values.imageUrl.trim())) {
    errors.imageUrl = "Image URL must be a valid http/https URL.";
  }

  return errors;
}

export function toArtworkDraft(values: ArtworkFormValues): ArtworkDraft {
  return {
    title: values.title.trim(),
    artist: values.artist.trim(),
    year: Number(values.year),
    price: Number(values.price),
    category: values.category.trim(),
    description: values.description.trim(),
    imageUrl: values.imageUrl.trim(),
  };
}

export function validateLoginForm(
  values: LoginFormValues,
): ValidationErrors<keyof LoginFormValues> {
  const errors: ValidationErrors<keyof LoginFormValues> = {};

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  return errors;
}

export function validateRegisterForm(
  values: RegisterFormValues,
): ValidationErrors<keyof RegisterFormValues> {
  const errors: ValidationErrors<keyof RegisterFormValues> = {};

  if (!values.username.trim()) {
    errors.username = "Username is required.";
  } else if (values.username.trim().length < 3) {
    errors.username = "Username must be at least 3 characters.";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
