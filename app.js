const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {

    console.log("Prisma script executed");

}


main()
.catch(e => {
    throw e
    })
    .finally(async () => {
        await prisma.$disconnect()
    })