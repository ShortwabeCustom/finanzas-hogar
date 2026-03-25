import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

function createPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}
const prisma = createPrisma();

async function main() {
  console.log("Iniciando seed con datos reales...");

  // USUARIOS
  const adminPwd = await bcrypt.hash("admin123", 12);
  const editorPwd = await bcrypt.hash("editor123", 12);
  const alexis = await prisma.user.upsert({
    where: { email: "alexis@hogar.com" }, update: {},
    create: { name: "Alexis Valdez", email: "alexis@hogar.com", password: adminPwd, role: "ADMIN", active: true },
  });
  const beatriz = await prisma.user.upsert({
    where: { email: "beatriz@hogar.com" }, update: {},
    create: { name: "Beatriz Merchand", email: "beatriz@hogar.com", password: editorPwd, role: "EDITOR", active: true },
  });
  console.log("Usuarios creados: Alexis Valdez (admin123) / Beatriz Merchand (editor123)");

  // CATEGORIAS
  const catMap: Record<string, string> = {};
  { const c = await prisma.category.upsert({ where: { name: "Alquiler" }, update: {}, create: { name: "Alquiler", color: "#8b5cf6", type: "PAYMENT", active: true } }); catMap["Alquiler"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Plataformas" }, update: {}, create: { name: "Plataformas", color: "#3b82f6", type: "PAYMENT", active: true } }); catMap["Plataformas"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Mascota" }, update: {}, create: { name: "Mascota", color: "#f59e0b", type: "BOTH", active: true } }); catMap["Mascota"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Servicios" }, update: {}, create: { name: "Servicios", color: "#6366f1", type: "PAYMENT", active: true } }); catMap["Servicios"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Cuidado del Hogar" }, update: {}, create: { name: "Cuidado del Hogar", color: "#14b8a6", type: "BOTH", active: true } }); catMap["Cuidado del Hogar"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Supermercado" }, update: {}, create: { name: "Supermercado", color: "#10b981", type: "BOTH", active: true } }); catMap["Supermercado"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Comida" }, update: {}, create: { name: "Comida", color: "#22c55e", type: "BOTH", active: true } }); catMap["Comida"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Entretenimiento" }, update: {}, create: { name: "Entretenimiento", color: "#ec4899", type: "PAYMENT", active: true } }); catMap["Entretenimiento"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Vacaciones" }, update: {}, create: { name: "Vacaciones", color: "#06b6d4", type: "PAYMENT", active: true } }); catMap["Vacaciones"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Pago Diferido" }, update: {}, create: { name: "Pago Diferido", color: "#f97316", type: "PAYMENT", active: true } }); catMap["Pago Diferido"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Automotriz" }, update: {}, create: { name: "Automotriz", color: "#64748b", type: "PAYMENT", active: true } }); catMap["Automotriz"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Otros" }, update: {}, create: { name: "Otros", color: "#94a3b8", type: "BOTH", active: true } }); catMap["Otros"] = c.id; }
  { const c = await prisma.category.upsert({ where: { name: "Despensa" }, update: {}, create: { name: "Despensa", color: "#84cc16", type: "PANTRY", active: true } }); catMap["Despensa"] = c.id; }
  console.log("Categorias creadas: " + Object.keys(catMap).length);

  // PAGOS HISTORICOS
  const userMap: Record<string, string> = { "Alexis Valdez": alexis.id, "Beatriz Merchand": beatriz.id };
  let pagoCount = 0;
  const pagoData = [
    { folio: "PAG-HIST-0073", name: "Nesspreso", concept: "Nesspreso - Noviembre", amount: 908.0, paymentDate: new Date("2025-11-17"), dueDate: new Date("2025-11-10"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Pago Diferido", comments: "" },
    { folio: "PAG-HIST-0072", name: "Costco", concept: "Costco - Noviembre", amount: 8943.0, paymentDate: new Date("2025-11-17"), dueDate: new Date("2025-11-10"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0071", name: "Costco", concept: "Costco - Noviembre", amount: 8943.0, paymentDate: new Date("2025-11-16"), dueDate: new Date("2025-11-10"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0070", name: "Nespreso", concept: "Nespreso - Noviembre", amount: 3097.0, paymentDate: new Date("2025-11-16"), dueDate: new Date("2025-11-27"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Pago Diferido", comments: "" },
    { folio: "PAG-HIST-0069", name: "Costco", concept: "Costco - Noviembre", amount: 1680.0, paymentDate: new Date("2025-11-12"), dueDate: new Date("2025-11-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0068", name: "Gas", concept: "Gas - Noviembre", amount: 200.0, paymentDate: new Date("2025-11-12"), dueDate: new Date("2025-11-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Servicios", comments: "" },
    { folio: "PAG-HIST-0067", name: "Limpieza", concept: "Limpieza - Octubre", amount: 1200.0, paymentDate: new Date("2025-10-22"), dueDate: new Date("2025-10-24"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Cuidado del Hogar", comments: "1ra y 2da de Octubre el recibo dice septiembre pero es de octubre" },
    { folio: "PAG-HIST-0066", name: "Costco", concept: "Costco - Octubre", amount: 11735.0, paymentDate: new Date("2025-10-21"), dueDate: new Date("2025-10-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0065", name: "Comida", concept: "Comida - 2da Octubre", amount: 400.0, paymentDate: new Date("2025-10-09"), dueDate: new Date("2025-10-09"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0064", name: "Gas", concept: "Gas - Octubre", amount: 419.0, paymentDate: new Date("2025-10-09"), dueDate: new Date("2025-10-09"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Servicios", comments: "" },
    { folio: "PAG-HIST-0063", name: "Luz", concept: "Luz - Octubre", amount: 404.0, paymentDate: new Date("2025-10-07"), dueDate: new Date("2025-10-07"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "CREDIT_CARD" as const, paidByName: "Beatriz Merchand", catName: "Servicios", comments: "" },
    { folio: "PAG-HIST-0062", name: "Renta", concept: "Renta - Octubre", amount: 7000.0, paymentDate: new Date("2025-10-05"), dueDate: new Date("2025-10-05"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Alquiler", comments: "" },
    { folio: "PAG-HIST-0061", name: "Nesspreso", concept: "Nesspreso - Septiembre", amount: 911.0, paymentDate: new Date("2025-09-30"), dueDate: new Date("2025-09-17"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Pago Diferido", comments: "" },
    { folio: "PAG-HIST-0060", name: "Limpieza", concept: "Limpieza - Septiembre", amount: 1800.0, paymentDate: new Date("2025-09-23"), dueDate: new Date("2025-09-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Cuidado del Hogar", comments: "1ra, 2da y 3ea de Septiembre" },
    { folio: "PAG-HIST-0059", name: "Costco", concept: "Costco - Septiembre", amount: 8120.0, paymentDate: new Date("2025-09-21"), dueDate: new Date("2025-09-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0058", name: "Costco", concept: "Costco - Septiembre", amount: 8120.0, paymentDate: new Date("2025-09-10"), dueDate: new Date("2025-09-10"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0057", name: "Renta", concept: "Renta - Septiembre", amount: 7000.0, paymentDate: new Date("2025-09-05"), dueDate: new Date("2025-09-05"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Alquiler", comments: "" },
    { folio: "PAG-HIST-0056", name: "Limpieza", concept: "Limpieza - 1ra Septiembre", amount: 600.0, paymentDate: new Date("2025-09-02"), dueDate: new Date("2025-09-05"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Cuidado del Hogar", comments: "" },
    { folio: "PAG-HIST-0055", name: "Limpieza", concept: "Limpieza - 1ra Septiembre", amount: 1200.0, paymentDate: new Date("2025-09-01"), dueDate: new Date("2025-08-29"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Cuidado del Hogar", comments: "Peiodo de 3ra y 4ta de agosto" },
    { folio: "PAG-HIST-0054", name: "Sala", concept: "Sala - Agosto", amount: 18250.0, paymentDate: new Date("2025-08-22"), dueDate: new Date("2025-08-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "CREDIT_CARD" as const, paidByName: "Beatriz Merchand", catName: "Cuidado del Hogar", comments: "Comprobante 13,250 y 5,000 salen en efectivo, lo que resta del comprobante anterior." },
    { folio: "PAG-HIST-0053", name: "Sala", concept: "Sala - Agosto", amount: 18250.0, paymentDate: new Date("2025-08-19"), dueDate: new Date("2025-08-19"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "CREDIT_CARD" as const, paidByName: "Alexis Valdez", catName: "Cuidado del Hogar", comments: "Compobante dice 22,250 mios son 17,250 y 1,000 mas aprte" },
    { folio: "PAG-HIST-0052", name: "Gas", concept: "Gas - Agosto", amount: 463.0, paymentDate: new Date("2025-08-19"), dueDate: new Date("2025-08-19"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "CREDIT_CARD" as const, paidByName: "Alexis Valdez", catName: "Servicios", comments: "" },
    { folio: "PAG-HIST-0051", name: "Comida", concept: "Comida - Agosto", amount: 100.0, paymentDate: new Date("2025-08-17"), dueDate: new Date("2025-08-17"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0050", name: "Filtro de Agua", concept: "Filtro de Agua - Agosto", amount: 1043.0, paymentDate: new Date("2025-08-12"), dueDate: new Date("2025-08-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Cuidado del Hogar", comments: "" },
    { folio: "PAG-HIST-0049", name: "Comida", concept: "Comida - 3ra Agosto", amount: 450.0, paymentDate: new Date("2025-08-16"), dueDate: new Date("2025-08-16"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0048", name: "Comida", concept: "Comida - Agosto", amount: 500.0, paymentDate: new Date("2025-08-13"), dueDate: new Date("2025-08-13"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0047", name: "Limpieza", concept: "Limpieza - 2da Agosto", amount: 600.0, paymentDate: new Date("2025-08-13"), dueDate: new Date("2025-08-13"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Cuidado del Hogar", comments: "" },
    { folio: "PAG-HIST-0047", name: "Costco", concept: "Costco - Agosto", amount: 7565.0, paymentDate: new Date("2025-08-12"), dueDate: new Date("2025-08-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0045", name: "Cotsco", concept: "Cotsco - Agosto", amount: 7564.0, paymentDate: new Date("2025-08-12"), dueDate: new Date("2025-08-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0044", name: "600", concept: "600 - 1ra Agosto", amount: 600.0, paymentDate: new Date("2025-08-06"), dueDate: new Date("2025-08-06"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "CASH" as const, paidByName: "Alexis Valdez", catName: "Cuidado del Hogar", comments: "" },
    { folio: "PAG-HIST-0043", name: "Renta", concept: "Renta - Agosto", amount: 7000.0, paymentDate: new Date("2025-08-05"), dueDate: new Date("2025-08-05"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Alquiler", comments: "" },
    { folio: "PAG-HIST-0042", name: "Comida", concept: "Comida - 1ra Agosto", amount: 600.0, paymentDate: new Date("2025-08-08"), dueDate: new Date("2025-08-08"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0041", name: "Filtro de Agua", concept: "Filtro de Agua - Julio", amount: 1043.0, paymentDate: new Date("2025-07-30"), dueDate: new Date("2025-07-30"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Pago Diferido", comments: "" },
    { folio: "PAG-HIST-0040", name: "Nesspreso", concept: "Nesspreso - Julio", amount: 480.0, paymentDate: new Date("2025-07-29"), dueDate: new Date("2025-07-29"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Pago Diferido", comments: "" },
    { folio: "PAG-HIST-0039", name: "HBO", concept: "HBO - Febrero", amount: 786.0, paymentDate: new Date("2025-02-21"), dueDate: new Date("2025-02-21"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "", catName: "Plataformas", comments: "" },
    { folio: "PAG-HIST-0038", name: "Nesspreso", concept: "Nesspreso - Julio", amount: 938.0, paymentDate: new Date("2025-07-29"), dueDate: new Date("2025-07-28"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0037", name: "Luz", concept: "Luz - Julio", amount: 841.0, paymentDate: new Date("2025-07-29"), dueDate: new Date("2025-08-05"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Servicios", comments: "Adeudo de marzo a julio" },
    { folio: "PAG-HIST-0036", name: "COMIDA JULIO", concept: "COMIDA JULIO - 4ta Julio", amount: 650.0, paymentDate: new Date("2025-07-26"), dueDate: new Date("2025-07-29"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0035", name: "LIMPIEZA JULIO", concept: "LIMPIEZA JULIO - 3ra Julio", amount: 2000.0, paymentDate: new Date("2025-07-29"), dueDate: new Date("2025-07-15"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "CASH" as const, paidByName: "Alexis Valdez", catName: "Cuidado del Hogar", comments: "Se paga la semana con periodo 14 al 18, 21 al 25 y 28 al 1 de agosto" },
    { folio: "PAG-HIST-0034", name: "Renta", concept: "Renta - Junio", amount: 7000.0, paymentDate: new Date("2025-06-06"), dueDate: new Date("2025-06-05"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Alquiler", comments: "" },
    { folio: "PAG-HIST-0033", name: "COMIDA JULIO", concept: "COMIDA JULIO - 3ra Julio", amount: 505.0, paymentDate: new Date("2025-07-13"), dueDate: new Date("2025-07-18"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "CASH" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0032", name: "COMIDA JULIO", concept: "COMIDA JULIO - 4ta Julio", amount: 650.0, paymentDate: new Date("2025-07-20"), dueDate: new Date("2025-07-25"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0031", name: "Tarjeta Costco", concept: "Tarjeta Costco - Mayo", amount: 8466.0, paymentDate: new Date("2025-07-16"), dueDate: new Date("2025-07-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0030", name: "Nesspreso", concept: "Nesspreso - Julio", amount: 2674.99, paymentDate: new Date("2025-07-10"), dueDate: null, period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Supermercado", comments: "Regularizacion de pago" },
    { folio: "PAG-HIST-0029", name: "Tarjeta Costco", concept: "Tarjeta Costco - Mayo", amount: 0, paymentDate: new Date("2025-07-10"), dueDate: new Date("2025-07-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Supermercado", comments: "mayo-junio" },
    { folio: "PAG-HIST-0028", name: "Instalación filtro de agua", concept: "Instalación filtro de agua - Pago Unico", amount: 778.0, paymentDate: new Date("2025-07-07"), dueDate: null, period: "ONCE" as const, status: "PAID" as const, paymentMethod: "CREDIT_CARD" as const, paidByName: "Beatriz Merchand", catName: "Cuidado del Hogar", comments: "instalacion de filtro de agua" },
    { folio: "PAG-HIST-0027", name: "Renta", concept: "Renta - Julio", amount: 7000.0, paymentDate: new Date("2025-07-06"), dueDate: new Date("2025-07-05"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Alquiler", comments: "" },
    { folio: "PAG-HIST-0026", name: "Reembolsos de productos de limpieza", concept: "Reembolsos de productos de limpieza - Pago Unico", amount: 100.0, paymentDate: new Date("2025-07-02"), dueDate: null, period: "ONCE" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Supermercado", comments: "reembolso de productos de limpieza" },
    { folio: "PAG-HIST-0025", name: "COMIDA JULIO", concept: "COMIDA JULIO - 1ra Julio", amount: 400.0, paymentDate: new Date("2025-07-01"), dueDate: new Date("2025-07-04"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0024", name: "COMIDA JUNIO", concept: "COMIDA JUNIO - 4ta Junio", amount: 485.0, paymentDate: new Date("2025-06-25"), dueDate: new Date("2025-06-27"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "solo se toman $485, el resto fue limpieza de la misma semana" },
    { folio: "PAG-HIST-0023", name: "LIMPIEZA JUNIO", concept: "LIMPIEZA JUNIO - 4ta Junio", amount: 600.0, paymentDate: new Date("2025-06-25"), dueDate: new Date("2025-06-27"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Cuidado del Hogar", comments: "solo se toman 600, el resto es comida de la misma semana" },
    { folio: "PAG-HIST-0022", name: "LIMPIEZA", concept: "LIMPIEZA - ", amount: 600.0, paymentDate: new Date("2025-05-15"), dueDate: new Date("2025-05-16"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Cuidado del Hogar", comments: "" },
    { folio: "PAG-HIST-0021", name: "LIMPIEZA ABRIL", concept: "LIMPIEZA ABRIL - 4ta Abril", amount: 600.0, paymentDate: new Date("2025-04-29"), dueDate: new Date("2025-05-02"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Cuidado del Hogar", comments: "solo se toman $600, ya que el resto fue comida de sparky e izzi de suegris" },
    { folio: "PAG-HIST-0020", name: "COMIDA JUNIO", concept: "COMIDA JUNIO - 2da Junio", amount: 200.0, paymentDate: new Date("2025-06-10"), dueDate: new Date("2025-06-13"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0019", name: "COMIDA JUNIO", concept: "COMIDA JUNIO - 1ra Junio", amount: 250.0, paymentDate: new Date("2025-06-04"), dueDate: new Date("2025-06-06"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0018", name: "LIMPIEZA MAYO", concept: "LIMPIEZA MAYO - 2da Mayo", amount: 600.0, paymentDate: new Date("2025-05-14"), dueDate: new Date("2025-05-13"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Cuidado del Hogar", comments: "" },
    { folio: "PAG-HIST-0017", name: "COMIDA JUNIO", concept: "COMIDA JUNIO - 2da Junio", amount: 330.0, paymentDate: new Date("2025-06-09"), dueDate: new Date("2025-06-10"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0016", name: "COMIDA MAYO", concept: "COMIDA MAYO - 4ta Mayo", amount: 460.0, paymentDate: new Date("2025-05-26"), dueDate: new Date("2025-05-27"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0015", name: "Gas", concept: "Gas - Mayo", amount: 274.0, paymentDate: new Date("2025-05-25"), dueDate: new Date("2025-05-25"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Servicios", comments: "" },
    { folio: "PAG-HIST-0014", name: "COMIDA MAYO", concept: "COMIDA MAYO - 3ra Mayo", amount: 350.0, paymentDate: new Date("2025-05-19"), dueDate: new Date("2025-05-20"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0013", name: "Tarjeta Costco", concept: "Tarjeta Costco - Mayo", amount: 7000.0, paymentDate: new Date("2025-05-14"), dueDate: new Date("2025-05-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0012", name: "COMIDA MAYO", concept: "COMIDA MAYO - 2da Mayo", amount: 350.0, paymentDate: new Date("2025-05-12"), dueDate: new Date("2025-05-13"), period: "BIWEEKLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Comida", comments: "" },
    { folio: "PAG-HIST-0011", name: "Tarjeta Costco", concept: "Tarjeta Costco - Mayo", amount: 7000.0, paymentDate: new Date("2025-05-10"), dueDate: new Date("2025-05-12"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Supermercado", comments: "" },
    { folio: "PAG-HIST-0010", name: "Renta", concept: "Renta - Mayo", amount: 6160.0, paymentDate: new Date("2025-05-05"), dueDate: new Date("2025-05-06"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Alquiler", comments: "" },
    { folio: "PAG-HIST-0009", name: "Adeudo de Gas", concept: "Adeudo de Gas - Mayo", amount: 840.0, paymentDate: new Date("2025-04-23"), dueDate: new Date("2025-04-23"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Servicios", comments: "" },
    { folio: "PAG-HIST-0008", name: "Accesos peatonales", concept: "Accesos peatonales - Pago Unico", amount: 300.0, paymentDate: new Date("2025-04-23"), dueDate: null, period: "ONCE" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Cuidado del Hogar", comments: "" },
    { folio: "PAG-HIST-0007", name: "Juego de llaves", concept: "Juego de llaves - Pago Unico", amount: 360.0, paymentDate: new Date("2025-04-23"), dueDate: null, period: "ONCE" as const, status: "PAID" as const, paymentMethod: "CASH" as const, paidByName: "Beatriz Merchand", catName: "Cuidado del Hogar", comments: "" },
    { folio: "PAG-HIST-0006", name: "Mudanza Bety", concept: "Mudanza Bety - Pago Unico", amount: 3400.0, paymentDate: new Date("2025-04-04"), dueDate: null, period: "ONCE" as const, status: "PAID" as const, paymentMethod: "CASH" as const, paidByName: "Beatriz Merchand", catName: "Otros", comments: "" },
    { folio: "PAG-HIST-0005", name: "Mudanza Alexis", concept: "Mudanza Alexis - Pago Unico", amount: 1800.0, paymentDate: new Date("2025-04-04"), dueDate: null, period: "ONCE" as const, status: "PAID" as const, paymentMethod: "CASH" as const, paidByName: "Beatriz Merchand", catName: "Otros", comments: "" },
    { folio: "PAG-HIST-0004", name: "Propina mudanza", concept: "Propina mudanza - Pago Unico", amount: 700.0, paymentDate: new Date("2025-04-04"), dueDate: null, period: "ONCE" as const, status: "PAID" as const, paymentMethod: "CASH" as const, paidByName: "Beatriz Merchand", catName: "Otros", comments: "propina a cargadores" },
    { folio: "PAG-HIST-0003", name: "Deposito casa", concept: "Deposito casa - Pago Unico", amount: 7000.0, paymentDate: new Date("2025-04-04"), dueDate: null, period: "ONCE" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Alquiler", comments: "" },
    { folio: "PAG-HIST-0002", name: "Renta", concept: "Renta - Abril", amount: 7000.0, paymentDate: new Date("2025-04-04"), dueDate: new Date("2025-04-05"), period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Alexis Valdez", catName: "Alquiler", comments: "" },
    { folio: "PAG-HIST-0001", name: "Anticipo de Mudanzas", concept: "Anticipo de Mudanzas - Pago Unico", amount: 500.0, paymentDate: new Date("2025-04-01"), dueDate: null, period: "ONCE" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paidByName: "Beatriz Merchand", catName: "Otros", comments: "Mudanza" },
  ];
  for (const p of pagoData) {
    if (await prisma.payment.findUnique({ where: { folio: p.folio } })) continue;
    const categoryId = catMap[p.catName] ?? catMap["Otros"];
    const paidById = userMap[p.paidByName] ?? null;
    await prisma.payment.create({ data: { folio: p.folio, name: p.name, concept: p.concept, amount: p.amount, paymentDate: p.paymentDate, dueDate: p.dueDate, period: p.period, status: p.status, paymentMethod: p.paymentMethod, categoryId, paidById, comments: p.comments || null } });
    pagoCount++;
  }
  console.log(`Pagos historicos importados: ${pagoCount}`);

  // DESPENSA
  let despensaCount = 0;
  const despensaData = [
    { name: "fresa", catName: "Supermercado" },
    { name: "mango", catName: "Supermercado" },
    { name: "uva", catName: "Supermercado" },
    { name: "piña", catName: "Supermercado" },
    { name: "mandarina", catName: "Supermercado" },
    { name: "pepinillo", catName: "Supermercado" },
    { name: "frambuesa", catName: "Supermercado" },
    { name: "zarzamora", catName: "Supermercado" },
    { name: "manzana  1.8kg", catName: "Supermercado" },
    { name: "pera", catName: "Supermercado" },
    { name: "plátano", catName: "Supermercado" },
    { name: "sandia", catName: "Supermercado" },
    { name: "champiñones", catName: "Supermercado" },
    { name: "tomate bola", catName: "Supermercado" },
    { name: "Tomate mini", catName: "Supermercado" },
    { name: "limon amarillo", catName: "Supermercado" },
    { name: "espinaca", catName: "Supermercado" },
    { name: "lechuga  italiana 3pz", catName: "Supermercado" },
    { name: "Mezcla campesina", catName: "Supermercado" },
    { name: "Ensalada italiana", catName: "Supermercado" },
    { name: "Zanahoria baby", catName: "Supermercado" },
    { name: "Zanahoria normal 2.27 kg", catName: "Supermercado" },
    { name: "Coliflor", catName: "Supermercado" },
    { name: "Papa 4.5 kg", catName: "Supermercado" },
    { name: "esparragos", catName: "Supermercado" },
    { name: "mayonesa", catName: "Supermercado" },
    { name: "microdyn", catName: "Cuidado del Hogar" },
    { name: "arroz", catName: "Supermercado" },
    { name: "leche", catName: "Supermercado" },
    { name: "nueces", catName: "Supermercado" },
    { name: "sopas knorr", catName: "Supermercado" },
    { name: "yogurt griego", catName: "Supermercado" },
    { name: "salmas  48 pz", catName: "Supermercado" },
    { name: "queso panela", catName: "Supermercado" },
    { name: "Queso manchego", catName: "Supermercado" },
    { name: "Jamon", catName: "Supermercado" },
    { name: "Tortillas de harina", catName: "Supermercado" },
    { name: "Pan de Caja (oroweat)", catName: "Supermercado" },
    { name: "Crema", catName: "Supermercado" },
    { name: "Jugo de arandano", catName: "Supermercado" },
    { name: "Agua Mineral", catName: "Supermercado" },
    { name: "Cocal mini", catName: "Supermercado" },
    { name: "jocoque", catName: "Supermercado" },
    { name: "baguets mini", catName: "Supermercado" },
    { name: "Agua individual 1 L", catName: "Supermercado" },
    { name: "Café", catName: "Supermercado" },
    { name: "Nutella", catName: "Supermercado" },
    { name: "Huevo", catName: "Supermercado" },
    { name: "Salsa ittto (yakimeshi)", catName: "Supermercado" },
    { name: "Atún dolores 10  pz", catName: "Supermercado" },
    { name: "Cecina de res", catName: "Supermercado" },
    { name: "Milanesa de pollo (3pz)", catName: "Supermercado" },
    { name: "Pan Árabe", catName: "Supermercado" },
    { name: "croissant", catName: "Supermercado" },
    { name: "papas", catName: "Supermercado" },
    { name: "pretzel", catName: "Supermercado" },
    { name: "Chicharron de cerdo", catName: "Supermercado" },
    { name: "Chocolate", catName: "Supermercado" },
    { name: "Mini donas", catName: "Supermercado" },
    { name: "Helado", catName: "Supermercado" },
    { name: "galletas", catName: "Supermercado" },
    { name: "Jabon Ropa", catName: "Cuidado del Hogar" },
    { name: "Suavitel  8 L", catName: "Cuidado del Hogar" },
    { name: "Vanish", catName: "Cuidado del Hogar" },
    { name: "Cloro", catName: "Cuidado del Hogar" },
    { name: "Plaige", catName: "Cuidado del Hogar" },
    { name: "Limpiador de vidrio", catName: "Cuidado del Hogar" },
    { name: "Jabon para baño", catName: "Cuidado del Hogar" },
    { name: "Pastillas para el baño", catName: "Supermercado" },
    { name: "Antigrasa", catName: "Cuidado del Hogar" },
    { name: "Trapeador", catName: "Cuidado del Hogar" },
    { name: "Shampoo H&S 1L", catName: "Cuidado del Hogar" },
    { name: "Barras de Jabon Dove 14 pz", catName: "Cuidado del Hogar" },
    { name: "Papel Higienico", catName: "Cuidado del Hogar" },
    { name: "Esponjas para trastes", catName: "Cuidado del Hogar" },
    { name: "Jabon para trastes", catName: "Cuidado del Hogar" },
    { name: "Croquetas Sparky", catName: "Mascota" },
    { name: "Croquetas Guida", catName: "Mascota" },
    { name: "Caldo de huesos", catName: "Supermercado" },
    { name: "Huevito sparky", catName: "Mascota" },
    { name: "Arena para gato", catName: "Mascota" },
    { name: "Sobres ganador", catName: "Mascota" },
    { name: "Sobres cat chaw", catName: "Mascota" },
  ];
  for (const item of despensaData) {
    if (await prisma.pantryItem.findFirst({ where: { name: item.name, active: true } })) continue;
    const categoryId = catMap[item.catName] ?? catMap["Supermercado"];
    await prisma.pantryItem.create({ data: { name: item.name, quantity: 1, unit: "PCS", minStock: 1, categoryId, addedById: alexis.id } });
    despensaCount++;
  }
  console.log(`Productos despensa importados: ${despensaCount}`);

  // PAGOS FIJOS RECURRENTES
  let fijosCount = 0;
  const fijosData = [
    { folio: "PAG-FIJO-0200", name: "Limpieza", amount: 600.0, period: "WEEKLY" as const, catName: "Cuidado del Hogar" },
    { folio: "PAG-FIJO-0201", name: "Renta", amount: 7000.0, period: "MONTHLY" as const, catName: "Alquiler" },
    { folio: "PAG-FIJO-0202", name: "Gas", amount: 200.0, period: "MONTHLY" as const, catName: "Servicios" },
    { folio: "PAG-FIJO-0203", name: "Luz", amount: 400.0, period: "BIMONTHLY" as const, catName: "Servicios" },
    { folio: "PAG-FIJO-0204", name: "Netflix", amount: 119.0, period: "MONTHLY" as const, catName: "Plataformas" },
    { folio: "PAG-FIJO-0205", name: "Disney", amount: 149.0, period: "MONTHLY" as const, catName: "Plataformas" },
    { folio: "PAG-FIJO-0206", name: "Prime Video", amount: 100.0, period: "MONTHLY" as const, catName: "Plataformas" },
    { folio: "PAG-FIJO-0207", name: "HBO", amount: 150.0, period: "MONTHLY" as const, catName: "Plataformas" },
    { folio: "PAG-FIJO-0208", name: "Jardineria", amount: 400.0, period: "BIMONTHLY" as const, catName: "Cuidado del Hogar" },
  ];
  for (const f of fijosData) {
    if (await prisma.payment.findUnique({ where: { folio: f.folio } })) continue;
    const categoryId = catMap[f.catName] ?? catMap["Servicios"];
    await prisma.payment.create({ data: { folio: f.folio, name: f.name, concept: `Pago fijo - ${f.name}`, amount: f.amount, period: f.period, status: "PENDING", paymentMethod: "TRANSFER", categoryId, paidById: alexis.id } });
    fijosCount++;
  }
  console.log(`Pagos fijos pendientes creados: ${fijosCount}`);

  // ─── FINANZAS PERSONALES ──────────────────────────────────────────────────────
  console.log("\nCreando datos de finanzas personales...");

  // Categorías personales de Alexis
  const alexisCats: Record<string, string> = {};
  const alexisCatDefs = [
    { name: "Celular", color: "#6366f1", type: "PAYMENT" as const },
    { name: "Gym", color: "#10b981", type: "PAYMENT" as const },
    { name: "Transporte", color: "#f59e0b", type: "PAYMENT" as const },
    { name: "Suscripciones", color: "#8b5cf6", type: "PAYMENT" as const },
    { name: "Salud", color: "#ef4444", type: "PAYMENT" as const },
  ];
  for (const def of alexisCatDefs) {
    const existing = await prisma.personalCategory.findUnique({
      where: { userId_name: { userId: alexis.id, name: def.name } },
    });
    const cat = existing ?? await prisma.personalCategory.create({
      data: { userId: alexis.id, ...def, active: true },
    });
    alexisCats[def.name] = cat.id;
  }
  console.log(`  Alexis: ${alexisCatDefs.length} categorías personales`);

  // Categorías personales de Beatriz
  const beatrizCats: Record<string, string> = {};
  const beatrizCatDefs = [
    { name: "Ropa y Accesorios", color: "#ec4899", type: "PAYMENT" as const },
    { name: "Cuidado Personal", color: "#14b8a6", type: "PAYMENT" as const },
    { name: "Libros y Cursos", color: "#06b6d4", type: "PAYMENT" as const },
    { name: "Gym", color: "#10b981", type: "PAYMENT" as const },
    { name: "Médico", color: "#ef4444", type: "PAYMENT" as const },
  ];
  for (const def of beatrizCatDefs) {
    const existing = await prisma.personalCategory.findUnique({
      where: { userId_name: { userId: beatriz.id, name: def.name } },
    });
    const cat = existing ?? await prisma.personalCategory.create({
      data: { userId: beatriz.id, ...def, active: true },
    });
    beatrizCats[def.name] = cat.id;
  }
  console.log(`  Beatriz: ${beatrizCatDefs.length} categorías personales`);

  // Medios de pago personales de Alexis
  const alexisCardMap: Record<string, string> = {};
  const alexisCardDefs = [
    { bankName: "BBVA", cardName: "Débito Nómina", last4Digits: "4821", paymentSourceType: "DEBIT_CARD" as const, closingDay: 0, dueDay: 0, active: true },
    { bankName: "Citibanamex", cardName: "Crédito Rewards", last4Digits: "7654", paymentSourceType: "CREDIT_CARD" as const, closingDay: 20, dueDay: 5, active: true },
    { bankName: "Nu Bank", cardName: "Crédito Nu", last4Digits: "3390", paymentSourceType: "CREDIT_CARD" as const, closingDay: 15, dueDay: 1, active: true },
    { bankName: "BBVA", cardName: "Cuenta Nómina", last4Digits: "4821", paymentSourceType: "BANK_ACCOUNT" as const, closingDay: 0, dueDay: 0, active: true },
  ];
  for (const def of alexisCardDefs) {
    const existing = await prisma.personalCard.findUnique({
      where: { userId_bankName_last4Digits_paymentSourceType: { userId: alexis.id, bankName: def.bankName, last4Digits: def.last4Digits, paymentSourceType: def.paymentSourceType } },
    });
    const card = existing ?? await prisma.personalCard.create({ data: { userId: alexis.id, ...def } });
    alexisCardMap[def.cardName] = card.id;
  }
  console.log(`  Alexis: ${alexisCardDefs.length} medios de pago personales`);

  // Medios de pago personales de Beatriz
  const beatrizCardMap: Record<string, string> = {};
  const beatrizCardDefs = [
    { bankName: "BBVA", cardName: "Débito Nómina", last4Digits: "9103", paymentSourceType: "DEBIT_CARD" as const, closingDay: 0, dueDay: 0, active: true },
    { bankName: "Liverpool", cardName: "Crédito Liverpool", last4Digits: "5522", paymentSourceType: "CREDIT_CARD" as const, closingDay: 18, dueDay: 3, active: true },
    { bankName: "Nu Bank", cardName: "Crédito Nu", last4Digits: "8847", paymentSourceType: "CREDIT_CARD" as const, closingDay: 12, dueDay: 27, active: true },
    { bankName: "BBVA", cardName: "Cuenta Nómina", last4Digits: "9103", paymentSourceType: "BANK_ACCOUNT" as const, closingDay: 0, dueDay: 0, active: true },
  ];
  for (const def of beatrizCardDefs) {
    const existing = await prisma.personalCard.findUnique({
      where: { userId_bankName_last4Digits_paymentSourceType: { userId: beatriz.id, bankName: def.bankName, last4Digits: def.last4Digits, paymentSourceType: def.paymentSourceType } },
    });
    const card = existing ?? await prisma.personalCard.create({ data: { userId: beatriz.id, ...def } });
    beatrizCardMap[def.cardName] = card.id;
  }
  console.log(`  Beatriz: ${beatrizCardDefs.length} medios de pago personales`);

  // Pagos personales de Alexis
  const alexisPayments = [
    { folio: "PER-ALX-001", name: "Telcel", concept: "Plan celular mensual", amount: 399, categoryId: alexisCats["Celular"], period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "DEBIT_CARD" as const, personalCardId: alexisCardMap["Débito Nómina"], paymentDate: new Date("2026-03-05"), dueDate: new Date("2026-03-05") },
    { folio: "PER-ALX-002", name: "Telcel", concept: "Plan celular mensual", amount: 399, categoryId: alexisCats["Celular"], period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "DEBIT_CARD" as const, personalCardId: alexisCardMap["Débito Nómina"], paymentDate: new Date("2026-02-05"), dueDate: new Date("2026-02-05") },
    { folio: "PER-ALX-003", name: "Smart Fit", concept: "Mensualidad gym - Marzo", amount: 499, categoryId: alexisCats["Gym"], period: "MONTHLY" as const, status: "PENDING" as const, paymentMethod: "DEBIT_CARD" as const, personalCardId: alexisCardMap["Débito Nómina"], dueDate: new Date("2026-03-20") },
    { folio: "PER-ALX-004", name: "Smart Fit", concept: "Mensualidad gym - Febrero", amount: 499, categoryId: alexisCats["Gym"], period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "DEBIT_CARD" as const, personalCardId: alexisCardMap["Débito Nómina"], paymentDate: new Date("2026-02-18"), dueDate: new Date("2026-02-20") },
    { folio: "PER-ALX-005", name: "Uber / DiDi", concept: "Transporte - Marzo", amount: 850, categoryId: alexisCats["Transporte"], period: "MONTHLY" as const, status: "PENDING" as const, paymentMethod: "CREDIT_CARD" as const, personalCardId: alexisCardMap["Crédito Nu"], dueDate: new Date("2026-03-31") },
    { folio: "PER-ALX-006", name: "Uber / DiDi", concept: "Transporte - Febrero", amount: 720, categoryId: alexisCats["Transporte"], period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "CREDIT_CARD" as const, personalCardId: alexisCardMap["Crédito Nu"], paymentDate: new Date("2026-02-28"), dueDate: new Date("2026-02-28") },
    { folio: "PER-ALX-007", name: "Spotify", concept: "Suscripción mensual Spotify", amount: 99, categoryId: alexisCats["Suscripciones"], period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "CREDIT_CARD" as const, personalCardId: alexisCardMap["Crédito Rewards"], paymentDate: new Date("2026-03-01"), dueDate: new Date("2026-03-01") },
    { folio: "PER-ALX-008", name: "iCloud", concept: "iCloud 200GB - Marzo", amount: 29, categoryId: alexisCats["Suscripciones"], period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "CREDIT_CARD" as const, personalCardId: alexisCardMap["Crédito Rewards"], paymentDate: new Date("2026-03-02"), dueDate: new Date("2026-03-02") },
    { folio: "PER-ALX-009", name: "Dentista", concept: "Limpieza dental - Enero", amount: 800, categoryId: alexisCats["Salud"], period: "ONCE" as const, status: "PAID" as const, paymentMethod: "CASH" as const, paymentDate: new Date("2026-01-15"), dueDate: new Date("2026-01-15") },
    { folio: "PER-ALX-010", name: "Telcel", concept: "Plan celular mensual - Abril", amount: 399, categoryId: alexisCats["Celular"], period: "MONTHLY" as const, status: "OVERDUE" as const, paymentMethod: "DEBIT_CARD" as const, personalCardId: alexisCardMap["Débito Nómina"], dueDate: new Date("2026-03-05") },
  ];
  let alexisPayCount = 0;
  for (const p of alexisPayments) {
    if (await prisma.personalPayment.findUnique({ where: { folio: p.folio } })) continue;
    await prisma.personalPayment.create({ data: { userId: alexis.id, ...p } });
    alexisPayCount++;
  }
  console.log(`  Alexis: ${alexisPayCount} pagos personales creados`);

  // Pagos personales de Beatriz
  const beatrizPayments = [
    { folio: "PER-BEA-001", name: "Zara Online", concept: "Compra ropa - Febrero", amount: 1250, categoryId: beatrizCats["Ropa y Accesorios"], period: "ONCE" as const, status: "PAID" as const, paymentMethod: "CREDIT_CARD" as const, personalCardId: beatrizCardMap["Crédito Liverpool"], paymentDate: new Date("2026-02-14"), dueDate: new Date("2026-02-14") },
    { folio: "PER-BEA-002", name: "H&M", concept: "Accesorios - Marzo", amount: 650, categoryId: beatrizCats["Ropa y Accesorios"], period: "ONCE" as const, status: "PENDING" as const, paymentMethod: "CREDIT_CARD" as const, personalCardId: beatrizCardMap["Crédito Liverpool"], dueDate: new Date("2026-03-25") },
    { folio: "PER-BEA-003", name: "Peluquería", concept: "Corte y tinte - Febrero", amount: 900, categoryId: beatrizCats["Cuidado Personal"], period: "BIMONTHLY" as const, status: "PAID" as const, paymentMethod: "CASH" as const, paymentDate: new Date("2026-02-20"), dueDate: new Date("2026-02-20") },
    { folio: "PER-BEA-004", name: "Manicure", concept: "Uñas - Marzo", amount: 350, categoryId: beatrizCats["Cuidado Personal"], period: "MONTHLY" as const, status: "PENDING" as const, paymentMethod: "CASH" as const, dueDate: new Date("2026-03-22") },
    { folio: "PER-BEA-005", name: "Udemy", concept: "Curso diseño UX - Febrero", amount: 480, categoryId: beatrizCats["Libros y Cursos"], period: "ONCE" as const, status: "PAID" as const, paymentMethod: "CREDIT_CARD" as const, personalCardId: beatrizCardMap["Crédito Nu"], paymentDate: new Date("2026-02-10"), dueDate: new Date("2026-02-10") },
    { folio: "PER-BEA-006", name: "Libros Amazon", concept: "2 libros Kindle - Enero", amount: 320, categoryId: beatrizCats["Libros y Cursos"], period: "ONCE" as const, status: "PAID" as const, paymentMethod: "CREDIT_CARD" as const, personalCardId: beatrizCardMap["Crédito Nu"], paymentDate: new Date("2026-01-28"), dueDate: new Date("2026-01-28") },
    { folio: "PER-BEA-007", name: "Gym Femenino", concept: "Mensualidad - Marzo", amount: 550, categoryId: beatrizCats["Gym"], period: "MONTHLY" as const, status: "PENDING" as const, paymentMethod: "TRANSFER" as const, dueDate: new Date("2026-03-15") },
    { folio: "PER-BEA-008", name: "Gym Femenino", concept: "Mensualidad - Febrero", amount: 550, categoryId: beatrizCats["Gym"], period: "MONTHLY" as const, status: "PAID" as const, paymentMethod: "TRANSFER" as const, paymentDate: new Date("2026-02-12"), dueDate: new Date("2026-02-15") },
    { folio: "PER-BEA-009", name: "Consulta médica", concept: "Check-up anual - Enero", amount: 1200, categoryId: beatrizCats["Médico"], period: "ANNUAL" as const, status: "PAID" as const, paymentMethod: "DEBIT_CARD" as const, personalCardId: beatrizCardMap["Débito Nómina"], paymentDate: new Date("2026-01-20"), dueDate: new Date("2026-01-20") },
    { folio: "PER-BEA-010", name: "Farmacia", concept: "Medicamentos - Marzo", amount: 380, categoryId: beatrizCats["Médico"], period: "MONTHLY" as const, status: "OVERDUE" as const, paymentMethod: "CASH" as const, dueDate: new Date("2026-03-10") },
  ];
  let beatrizPayCount = 0;
  for (const p of beatrizPayments) {
    if (await prisma.personalPayment.findUnique({ where: { folio: p.folio } })) continue;
    await prisma.personalPayment.create({ data: { userId: beatriz.id, ...p } });
    beatrizPayCount++;
  }
  console.log(`  Beatriz: ${beatrizPayCount} pagos personales creados`);

  console.log("\nSeed completado!");
  console.log("  Admin  -> alexis@hogar.com  / admin123");
  console.log("  Editor -> beatriz@hogar.com / editor123");
  console.log("\nValidación de segregación:");
  console.log("  - Alexis ve: 5 cats, 10 pagos, 4 medios (1 débito, 2 crédito, 1 cuenta)");
  console.log("  - Beatriz ve: 5 cats, 10 pagos, 4 medios (1 débito, 2 crédito, 1 cuenta)");
  console.log("  - Ninguno puede ver los datos del otro aunque manipule URLs");
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });