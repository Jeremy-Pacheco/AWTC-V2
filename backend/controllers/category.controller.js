const { Category } = require('../models');

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    console.error('Category controller error:', error.message);
    res.status(400).json({ message: 'Error creating category' });
  }
};

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.status(200).json(categories);
  } catch (error) {
    console.error('Category controller error:', error.message);
    res.status(500).json({ message: 'Error retrieving categories' });
  }
};

// Update a category
exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    await category.update(req.body);
    res.status(200).json(category);
  } catch (error) {
    console.error('Category controller error:', error.message);
    res.status(400).json({ message: 'Error updating category' });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    await category.destroy();
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Category controller error:', error.message);
    res.status(500).json({ message: 'Error deleting category' });
  }
};