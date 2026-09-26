/* File: backend/src/modules/user/user.service.ts */
import User, { IUser, UserRole } from '../../models/User';
import { Types } from 'mongoose';

export interface FindOrCreateCustomerDTO {
  numeroDocumento?: string;
  tipoDocumento?: 'DNI' | 'RUC' | 'CE';
  nombre: string;
  apellidos?: string;
  telefono?: string;
  email?: string;
}

export class UserService {
  /**
   * Obtiene un usuario por ID excluyendo password
   */
  async getUserById(id: string | Types.ObjectId): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(id.toString())) return null;
    return await User.findById(id).select('-password');
  }

  /**
   * Valida si un empleado existe y tiene rol operativo (administrador o vendedor)
   */
  async validateEmployee(employeeId: string | Types.ObjectId): Promise<IUser> {
    const employee = await this.getUserById(employeeId);
    if (!employee) {
      throw new Error('El empleado asignado no existe en el sistema.');
    }
    if (employee.rol !== 'administrador' && employee.rol !== 'vendedor') {
      throw new Error(`El usuario ${employee.nombre} no tiene permisos operativos de venta.`);
    }
    return employee;
  }

  /**
   * Busca un cliente por documento o crea uno rápido para el POS si no existe
   */
  async findOrCreateCustomer(data: FindOrCreateCustomerDTO): Promise<IUser | null> {
    // Si no hay documento o es "Clientes Varios", no creamos cuenta de usuario
    if (!data.numeroDocumento || data.numeroDocumento.trim() === '' || data.numeroDocumento === '-') {
      return null;
    }

    const docTrimmed = data.numeroDocumento.trim();

    // 1. Buscar si ya existe por número de documento
    let customer = await User.findOne({ numeroDocumento: docTrimmed });
    if (customer) {
      return customer;
    }

    // 2. Si viene email, verificar si existe por email para evitar Duplicate Key Error
    if (data.email && data.email.trim() !== '') {
      const emailUser = await User.findOne({ email: data.email.toLowerCase().trim() });
      if (emailUser) {
        if (!emailUser.numeroDocumento) {
          emailUser.numeroDocumento = docTrimmed;
          if (data.tipoDocumento) emailUser.tipoDocumento = data.tipoDocumento;
          await emailUser.save();
        }
        return emailUser;
      }
    }

    // 3. Crear cliente rápido autogenerando email temporal único si no fue provisto
    const generatedEmail = (data.email && data.email.trim() !== '')
      ? data.email.toLowerCase().trim()
      : `cliente_${docTrimmed}@sycmobile.pe`;

    customer = await User.create({
      nombre: data.nombre.trim(),
      apellidos: data.apellidos?.trim() || '',
      tipoDocumento: data.tipoDocumento || 'DNI',
      numeroDocumento: docTrimmed,
      telefono: data.telefono?.trim() || '',
      email: generatedEmail,
      rol: 'cliente' as UserRole,
    });

    return customer;
  }

  /**
   * Buscar clientes en tiempo real en el POS por Documento o Nombre
   */
  async searchCustomers(query: string, limit: number = 10): Promise<IUser[]> {
    if (!query || query.trim() === '') return [];

    const cleanQuery = query.trim();
    return await User.find({
      rol: 'cliente',
      $or: [
        { numeroDocumento: { $regex: cleanQuery,$options: 'i' } },
        { nombre: { $regex: cleanQuery,$options: 'i' } },
        { apellidos: { $regex: cleanQuery,$options: 'i' } },
        { telefono: { $regex: cleanQuery,$options: 'i' } },
      ],
    })
      .select('nombre apellidos tipoDocumento numeroDocumento telefono email')
      .limit(limit)
      .lean();
  }
}