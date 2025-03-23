const {Router}=require("express");
const employeeRouter=Router();
const jwt=require("jsonwebtoken");
const employeeModel=require("../models/EmployeeModel");
const CompanyModel=require("../models/CompanyModel");
const PensionModel=require("../models/PensionModel");
const bcrypt=require("bcrypt");
const { v4:uuidv4 }=require('uuid');
const { authenticate }=require("../middlewares/employeeAuth");


const JWT_employee_secret="hash123";

async function generateUniqueEmployeeID() {
    let isUnique = false;
    let newEmployeeID;

    while (!isUnique) {
        newEmployeeID = `EMP-${uuidv4().split('-')[0].toUpperCase()}`; 
        const existingEmployee = await employeeModel.findOne({ employeeId: newEmployeeID });
        if (!existingEmployee) isUnique = true; // Ensure ID is unique
    }

    return newEmployeeID;
}

employeeRouter.post("/signup",async(req,res)=>{

    const name=req.body.name;
    const email=req.body.email;
    const password=req.body.password;
    let dateOfJoining=req.body.dateOfJoining;
    const employeeId=await generateUniqueEmployeeID();
    const companyName=req.body.companyName;
    const date=new Date(dateOfJoining);

    if(isNaN(date)){
        return res.status(400).json({
            error:"Invalid Date Format"
        });
    }

    const datetoJoin=date.toISOString();
    const salary=req.body.salary; 
    

    try{

        const exisitingEmp=await employeeModel.findOne({ email });
        if(exisitingEmp){
            return res.status(400).json({ msg:"Employee Already Exists"});
        }

        const company=await CompanyModel.findOne({name:companyName});
        if(!company){
            return res.status(404).json({ msg: "Company not found" });
        }

        const hashedPassword=await bcrypt.hash(password,5);
        
        const newEmployee=await employeeModel.create({
            name:name,
            email:email,
            password:hashedPassword,
            dateOfJoining:datetoJoin,
            employeeId:employeeId, 
            salary:salary,
            companyId:company._id,
        });

        const token=jwt.sign({
            id:newEmployee.employeeId,
            companyId:newEmployee.companyId,
        },JWT_employee_secret);


        return res.status(201).json({
            token:token,
            msg:"Employee has been logged in",
            employee: newEmployee,
        });
        

    }
    catch(err){
        console.error("Error during employee signup:", err);
        res.status(500).json({ msg: "Failed to create employee" });
    }

});

employeeRouter.post("/signin",async(req,res)=>{

    const email=req.body.email;
    const password=req.body.password;

    const employee=await employeeModel.findOne({
        email:email
    });

    if(employee){
        const passwordMatch=await bcrypt.compare(password,employee.password);
        
            if(passwordMatch){
                const token=jwt.sign({
                    id:employee.employeeId,
                    companyId:employee.companyId,
                },JWT_employee_secret);
                res.json({
                    token:token,
                    msg:"Employee has been logged in"
                });
            }
            else{
                return res.status(403).json({
                    msg:"Invalid Password"
                })
            }
    }
    else{      
        res.status(403).json({
            msg:"User does not exist"
        });
        return;       
    }

});

employeeRouter.get("/profile", authenticate, async (req, res) => {
    try {
      const { id } = req.user; // This should be the employeeId from the token
      const employee = await employeeModel.findOne({ employeeId: id });
      
      if (!employee) {
        return res.status(404).json({ msg: "Employee not found" });
      }
      
      res.json(employee);
    } catch (err) {
      console.error("Error fetching employee profile:", err);
      res.status(500).json({ msg: "Failed to fetch profile" });
    }
});

employeeRouter.get("/pension-schemes",authenticate,async(req,res)=>{
    try{
        const schemes=await PensionModel.find({});
        res.json(schemes);
    }catch(err){
        console.error("Error fetching pension schemes:", err);
        res.status(500).json({ msg: "Failed to fetch pension schemes" });
    }
});

employeeRouter.post("/apply-pension-scheme",authenticate,async(req,res)=>{
    
    try {
        const { schemeId, investmentAmount } = req.body;
        const employeeId = req.user.id;


        const scheme = await PensionModel.findById(schemeId);
        if (!scheme) {
            return res.status(404).json({ msg: "Pension scheme not found" });
        }


        if (investmentAmount < scheme.minimumInvestment || investmentAmount > scheme.maximumInvestment) {
            return res.status(400).json({ msg: "Investment amount is out of range" });
        }


        const employee = await employeeModel.findOne({ employeeId });
        if (!employee) {
            return res.status(404).json({ msg: "Employee not found" });
        }

        // Add the scheme to the employee's applied schemes
        employee.appliedSchemes.push({
            schemeId: scheme._id,
            schemeName: scheme.name,
            investmentAmount,
            status: "Pending", 
            appliedAt: new Date(),
        });

        await employee.save();

        res.json({ msg: "Pension scheme applied successfully", employee });
    } catch (err) {
        console.error("Error applying for pension scheme:", err);
        res.status(500).json({ msg: "Failed to apply for pension scheme" });
    }

});

employeeRouter.get("/applied-schemes", authenticate, async (req, res) => {
    try {
        const employeeId = req.user.id; 

        const employee = await employeeModel.findOne({ employeeId });

        if (!employee) {
            return res.status(404).json({ msg: "Employee not found" });
        }

        res.json(employee.appliedSchemes);
    } catch (err) {
        console.error("Error fetching applied schemes:", err);
        res.status(500).json({ msg: "Failed to fetch applied schemes" });
    }
});



module.exports={
    employeeRouter:employeeRouter,
}