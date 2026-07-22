# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# prisma
- For batch transactions, use the interactive pattern `prisma.$transaction(async (tx) => { ... })` instead of the array form `prisma.$transaction([...])` to avoid needing the `PrismaPromise` type which can cause production build failures when imported from `@prisma/client`. Confidence: 0.70

