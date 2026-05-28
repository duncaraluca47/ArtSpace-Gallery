/// <reference types="vitest/globals" />

import {
  toArtworkDraft,
  validateArtworkForm,
  validateLoginForm,
  validateRegisterForm,
  type ArtworkFormValues,
} from "../../src/app/validation/forms";

describe("forms validation", () => {
  const validArtwork: ArtworkFormValues = {
    title: "Moonrise",
    artist: "Ana Pop",
    year: "2024",
    price: "1200",
    category: "Abstract",
    description: "A long enough description for validation to pass.",
    imageUrl: "https://example.com/art.jpg",
  };

  it("accepts a valid artwork form", () => {
    expect(validateArtworkForm(validArtwork)).toEqual({});
  });

  it("returns errors for invalid artwork fields", () => {
    const errors = validateArtworkForm({
      ...validArtwork,
      artist: "",
      title: "",
      year: "abc",
      price: "0",
      category: "",
      description: "",
      imageUrl: "",
    });

    expect(errors.artist).toBeDefined();
    expect(errors.title).toBeDefined();
    expect(errors.year).toBeDefined();
    expect(errors.price).toBeDefined();
    expect(errors.category).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.imageUrl).toBeDefined();
  });

  it("returns range and format errors for artwork fields", () => {
    const errors = validateArtworkForm({
      ...validArtwork,
      year: "999",
      price: "not-a-number",
      description: "short",
      imageUrl: "ftp://bad",
    });

    expect(errors.year).toBeDefined();
    expect(errors.price).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.imageUrl).toBeDefined();
  });

  it("rejects prices higher than 100000", () => {
    const errors = validateArtworkForm({
      ...validArtwork,
      price: "100001",
    });

    expect(errors.price).toBe("Price must not exceed 100000.");
  });

  it("maps artwork form values to draft payload", () => {
    expect(
      toArtworkDraft({
        ...validArtwork,
        title: "  Moonrise  ",
      }),
    ).toEqual({
      title: "Moonrise",
      artist: "Ana Pop",
      year: 2024,
      price: 1200,
      category: "Abstract",
      description: "A long enough description for validation to pass.",
      imageUrl: "https://example.com/art.jpg",
    });
  });

  it("validates login form", () => {
    expect(validateLoginForm({ email: "", password: "" })).toEqual({
      email: "Email is required.",
      password: "Password is required.",
    });

    expect(validateLoginForm({ email: "not-an-email", password: "short" })).toEqual({
      email: "Enter a valid email address.",
      password: "Password must be at least 8 characters.",
    });

    expect(validateLoginForm({ email: "user@example.com", password: "password123" })).toEqual({});
  });

  it("validates register form and password confirmation", () => {
    const errors = validateRegisterForm({
      username: "ab",
      email: "invalid",
      password: "12345678",
      confirmPassword: "not-matching",
    });

    expect(errors.username).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.confirmPassword).toBeDefined();

    expect(
      validateRegisterForm({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
      }),
    ).toEqual({
      username: "Username is required.",
      email: "Email is required.",
      password: "Password is required.",
      confirmPassword: "Please confirm your password.",
    });

    expect(
      validateRegisterForm({
        username: "artistUser",
        email: "artist@example.com",
        password: "short",
        confirmPassword: "short",
      }),
    ).toEqual({
      password: "Password must be at least 8 characters.",
    });

    expect(
      validateRegisterForm({
        username: "artistUser",
        email: "artist@example.com",
        password: "password123",
        confirmPassword: "",
      }),
    ).toEqual({
      confirmPassword: "Please confirm your password.",
    });

    expect(
      validateRegisterForm({
        username: "artistUser",
        email: "artist@example.com",
        password: "password123",
        confirmPassword: "password123",
      }),
    ).toEqual({});
  });
});
