const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");

async function main() {
  const password = "Asdfasdf@123";
  const hash = await bcrypt.hash(password, 10);

  // Your account
  const kyawSoe = await prisma.user.upsert({
    where: { username: "kyawsoe" },
    update: {},
    create: {
      username: "kyawsoe",
      email: "kyawsoe@gmail.com",
      passwordHash: hash,
      displayName: "Kyaw Soe",
    },
  });

  // Friends
  const aungSiThu = await prisma.user.upsert({
    where: { username: "aungsithu" },
    update: {},
    create: {
      username: "aungsithu",
      email: "aungsithu@gmail.com",
      passwordHash: hash,
      displayName: "Aung Si Thu",
    },
  });

  const kyawThetAung = await prisma.user.upsert({
    where: { username: "kyawthetaung" },
    update: {},
    create: {
      username: "kyawthetaung",
      email: "kyawthetaung@gmail.com",
      passwordHash: hash,
      displayName: "Kyaw Thet Aung",
    },
  });

  const htayThanAung = await prisma.user.upsert({
    where: { username: "htaythanaung" },
    update: {},
    create: {
      username: "htaythanaung",
      email: "htaythanaung@gmail.com",
      passwordHash: hash,
      displayName: "Htay Than Aung",
    },
  });

  const maydMoeKo = await prisma.user.upsert({
    where: { username: "maydmoeko" },
    update: {},
    create: {
      username: "maydmoeko",
      email: "maydmoeko@gmail.com",
      passwordHash: hash,
      displayName: "Mayd Moe Ko",
    },
  });

  console.log("Users successfully seeded", {
    kyawSoe,
    aungSiThu,
    kyawThetAung,
    htayThanAung,
    maydMoeKo,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
