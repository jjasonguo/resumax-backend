import User from "../models/User.js"

export async function getAllTest(req,res) {
    try {
        const users = await User.find()
        res.status(200).json(users)
    } catch (error){
        console.log("getAllError", error)
        res.status(500).json({message: "internal error"});
    }
}

export function createTest(req, res) {
    res.status(201).send("post works");
}

export function updateTest(req,res) {
    res.status(200).json({message: "test update works"});
}

export function deleteTest(req,res) {
    res.status(200).json({message: "test delete works"});
}