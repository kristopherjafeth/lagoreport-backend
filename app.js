const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {

    console.log("Created a new greenhouse" );

}


main()
.catch(e => {
    throw e
    })
    .finally(async () => {
        await prisma.$disconnect()
    })