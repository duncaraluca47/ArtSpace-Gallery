import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/backend/app";
import {
  disconnectTestDatabase,
  migrateTestDatabase,
  truncateTestDatabase,
} from "./dbTestUtils";
import { completeMfaLogin, seedStandardAuthUsers } from "./authTestUtils";

vi.mock("../../src/utils/mailer", () => ({
  sendEmail: vi.fn(async () => undefined),
}));

vi.mock("../../src/utils/emailOtp", async () => {
  const actual = await vi.importActual<typeof import("../../src/utils/emailOtp")>("../../src/utils/emailOtp");

  return {
    ...actual,
    generateOtpCode: () => "123456",
  };
});

describe("Reviews REST API", () => {
  beforeAll(() => {
    migrateTestDatabase();
  });

  beforeEach(async () => {
    await truncateTestDatabase();
  });

  afterEach(async () => {
    await truncateTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("lists, creates, updates and deletes reviews for an artwork", async () => {
    const { user: credentials, admin: adminCredentials } = await seedStandardAuthUsers();
    const { app } = createApp({ seed: [] });
    const loginResponse = await completeMfaLogin(app, credentials);
    const accessToken = loginResponse.body.accessToken as string;
    const adminLoginResponse = await completeMfaLogin(app, adminCredentials);
    const adminHeaders = {
      Authorization: `Bearer ${adminLoginResponse.body.accessToken as string}`,
    };

    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
    };

    // create artwork first
    const payload = {
      title: "Reviewable",
      artist: "Reviewer",
      year: 2024,
      price: 100,
      category: "Test",
      description: "This artwork is used for review endpoint tests.",
      imageUrl: "https://example.com/rev.jpg",
    };

    const createArt = await request(app).post("/api/artworks").set(adminHeaders).send(payload);
    expect(createArt.status).toBe(201);
    const id = createArt.body.id;

    // initially no reviews
    const listEmpty = await request(app).get(`/api/artworks/${id}/reviews`);
    expect(listEmpty.status).toBe(200);
    expect(Array.isArray(listEmpty.body)).toBe(true);
    expect(listEmpty.body.length).toBe(0);

    // create a review
    const newReview = { userName: "Alice", rating: 5, comment: "Amazing" };
    const createReview = await request(app).post(`/api/artworks/${id}/reviews`).set(authHeaders).send(newReview);
    expect(createReview.status).toBe(201);
    expect(createReview.body).toMatchObject({ userName: credentials.username, rating: 5, comment: "Amazing" });
    const reviewId = createReview.body.id;

    // list now contains the review
    const listAfter = await request(app).get(`/api/artworks/${id}/reviews`);
    expect(listAfter.status).toBe(200);
    expect(listAfter.body.length).toBe(1);

    // update the review
    const updateResp = await request(app)
      .put(`/api/artworks/${id}/reviews/${reviewId}`)
      .set(authHeaders)
      .send({ rating: 4, comment: "Very good" });
    expect(updateResp.status).toBe(200);
    expect(updateResp.body.rating).toBe(4);
    expect(updateResp.body.comment).toBe("Very good");

    // delete the review
    const del = await request(app).delete(`/api/artworks/${id}/reviews/${reviewId}`).set(authHeaders);
    expect(del.status).toBe(204);

    const secondReview = await request(app)
      .post(`/api/artworks/${id}/reviews`)
      .set(authHeaders)
      .send({ userName: "Alice", rating: 4, comment: "Second review" });
    expect(secondReview.status).toBe(201);

    const adminDelete = await request(app)
      .delete(`/api/artworks/${id}/reviews/${secondReview.body.id}`)
      .set(adminHeaders);
    expect(adminDelete.status).toBe(204);

    const listFinal = await request(app).get(`/api/artworks/${id}/reviews`);
    expect(listFinal.status).toBe(200);
    expect(listFinal.body.length).toBe(0);
  });

  it("validates review payloads and id params", async () => {
    const { user: credentials, admin: adminCredentials } = await seedStandardAuthUsers();
    const { app } = createApp({ seed: [] });
    const loginResponse = await completeMfaLogin(app, credentials);
    const authHeaders = {
      Authorization: `Bearer ${loginResponse.body.accessToken as string}`,
    };
    const adminLoginResponse = await completeMfaLogin(app, adminCredentials);
    const adminHeaders = {
      Authorization: `Bearer ${adminLoginResponse.body.accessToken as string}`,
    };

    const createArt = await request(app).post("/api/artworks").set(adminHeaders).send({
      title: "Validation",
      artist: "Validator",
      year: 2024,
      price: 100,
      category: "Test",
      description: "Desc longer than twenty chars.",
      imageUrl: "https://example.com/val.jpg",
    });
    const id = createArt.body.id;

    // missing fields
    const bad = await request(app)
      .post(`/api/artworks/${id}/reviews`)
      .set(authHeaders)
      .send({ userName: "", rating: 10, comment: "" });
    expect(bad.status).toBe(400);

    // malformed ids
    const badGet = await request(app).get(`/api/artworks/%20/reviews`);
    expect(badGet.status).toBe(400);

    const badPut = await request(app).put(`/api/artworks/${id}/reviews/%20`).send({ rating: 3 });
    expect(badPut.status).toBe(400);
  });
});
