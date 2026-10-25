const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { validate } = require("class-validator");
const { AuthService } = require("../dist/auth/auth.service.js");
const { LoginDto, RegisterDto } = require("../dist/auth/dto/index.js");

const player = {
  id: "player",
  phone: "+77001234567",
  nickname: "player_one",
  name: "Player",
  role: "USER",
  isActive: true,
  totalScore: 0,
  loyaltyStatus: "BRONZE",
  balance: { availableSeconds: 600 },
};
function service(overrides = {}) {
  const calls = [];
  const prisma = {
    user: {
      findFirst: async () => null,
      findUnique: async () => null,
      create: async (args) => {
        calls.push(args.data);
        return { ...player, ...args.data };
      },
      ...overrides,
    },
  };
  const jwt = { signAsync: async () => "signed-token" };
  return {
    auth: new AuthService(prisma, jwt, { get: () => undefined }),
    calls,
  };
}

test("registration hashes the chosen password, normalizes identifiers, and never returns its hash", async () => {
  const { auth, calls } = service();
  const response = await auth.register({
    phone: "87001234567",
    nickname: "Player_ONE",
    password: "a-long-password",
  });
  assert.equal(calls[0].phone, "+77001234567");
  assert.equal(calls[0].nickname, "player_one");
  assert.notEqual(calls[0].passwordHash, "a-long-password");
  assert.equal(
    await bcrypt.compare("a-long-password", calls[0].passwordHash),
    true,
  );
  assert.equal(response.user.passwordHash, undefined);
  assert.equal(response.accessToken, "signed-token");
  assert.equal(calls[0].balance.create.availableSeconds, 0);
});

test("login accepts a nickname or formatted phone with a matching password", async () => {
  const passwordHash = await bcrypt.hash("secret-password", 4);
  for (const identifier of [
    " PLAYER_ONE ",
    "+7 (700) 123-45-67",
    "87001234567",
  ]) {
    let where;
    const { auth } = service({
      findFirst: async (args) => {
        where = args.where;
        return { ...player, passwordHash };
      },
    });
    assert.equal(
      (await auth.login({ identifier, password: "secret-password" })).user.id,
      "player",
    );
    if (identifier.includes("PLAYER"))
      assert.equal(where.OR[0].nickname.equals, "PLAYER_ONE");
    else assert.equal(where.OR[1].phone, "+77001234567");
  }
});

test("wrong passwords, old accounts without passwords, blocked users and CRM staff cannot log in", async () => {
  const passwordHash = await bcrypt.hash("secret-password", 4);
  for (const user of [
    null,
    { ...player, passwordHash: null },
    { ...player, passwordHash, isActive: false },
    { ...player, passwordHash, role: "ADMIN" },
  ]) {
    const { auth } = service({ findFirst: async () => user });
    await assert.rejects(
      auth.login({ identifier: "player_one", password: "secret-password" }),
      /Неверный логин или пароль/,
    );
  }
  const { auth } = service({
    findFirst: async () => ({ ...player, passwordHash }),
  });
  await assert.rejects(
    auth.login({ identifier: "player_one", password: "1234" }),
    /Неверный логин или пароль/,
  );
});

test("registration never takes over an existing phone or nickname and handles unique constraint races", async () => {
  const dto = {
    phone: "+77001234567",
    nickname: "player_one",
    password: "secret-password",
  };
  await assert.rejects(
    service({ findUnique: async () => player }).auth.register(dto),
    /номер телефона уже зарегистрирован/,
  );
  await assert.rejects(
    service({ findFirst: async () => player }).auth.register(dto),
    /никнейм уже занят/,
  );
  await assert.rejects(
    service({
      create: async () => {
        throw { code: "P2002" };
      },
    }).auth.register(dto),
    /уже зарегистрирован/,
  );
});

test("DTO validation rejects legacy code-only login and unsafe registration passwords", async () => {
  const login = Object.assign(new LoginDto(), {
    phone: "+77001234567",
    code: "1234",
  });
  assert.ok((await validate(login)).some((e) => e.property === "password"));
  const dto = {
    phone: "+77001234567",
    nickname: "player_one",
    password: "strong-password",
  };
  assert.equal(
    (await validate(Object.assign(new RegisterDto(), dto))).length,
    0,
  );
  for (const password of ["1234", "a".repeat(73), "я".repeat(37)]) {
    assert.ok(
      (
        await validate(Object.assign(new RegisterDto(), { ...dto, password }))
      ).some((e) => e.property === "password"),
    );
  }
});
