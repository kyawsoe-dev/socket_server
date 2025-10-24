const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");

async function main() {
  const password = "Asdfasdf@123";
  const hash = await bcrypt.hash(password, 10);
  const kyawsoe = await prisma.user.upsert({
    where: { username: "kyawsoe" },
    update: {},
    create: {
      username: "kyawsoe",
      email: "kyawsoe@gmail.com",
      passwordHash: hash,
      displayName: "Kyaw Soe",
    },
  });
  const ayeaye = await prisma.user.upsert({
    where: { username: "ayeaye" },
    update: {},
    create: {
      username: "ayeaye",
      email: "ayeaye@gmail.com",
      passwordHash: hash,
      displayName: "Aye Aye",
    },
  });

  const kyawkyaw = await prisma.user.upsert({
    where: { username: "kyawkyaw" },
    update: {},
    create: {
      username: "kyawkyaw",
      email: "kyawkyaw@gmail.com",
      passwordHash: hash,
      displayName: "Kyaw Kyaw",
    },
  });

  console.log("User successfully seed", { kyawsoe, kyawkyaw, ayeaye });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
