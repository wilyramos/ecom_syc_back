import bcrypt from 'bcrypt'

export const hashPassword = async (password: string) => {
    const salt = await bcrypt.genSalt(10) // 10 is the number of rounds
    return await bcrypt.hash(password, salt) //
}
export const checkPassword = async (enteredPassword: string, storedHash: string) => {
    return await bcrypt.compare(enteredPassword, storedHash)
}