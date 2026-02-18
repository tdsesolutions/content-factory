/**
 * Content Generator for TDS E Solutions
 * Generates captions with rotation logic to avoid repetition within 7 days
 */

const fs = require('fs');
const path = require('path');

class ContentGenerator {
  constructor(options = {}) {
    this.libraryPath = options.libraryPath || path.join(__dirname, 'content-library.json');
    this.rotationStatePath = options.rotationStatePath || path.join(__dirname, 'rotation-state.json');
    this.library = this.loadLibrary();
    this.rotationState = this.loadRotationState();
    this.defaultValues = this.library.default_values || {};
  }

  /**
   * Load the content library from JSON file
   */
  loadLibrary() {
    try {
      const data = fs.readFileSync(this.libraryPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading content library:', error);
      throw new Error('Failed to load content library');
    }
  }

  /**
   * Load rotation state (tracks recently used templates)
   */
  loadRotationState() {
    try {
      if (fs.existsSync(this.rotationStatePath)) {
        const data = fs.readFileSync(this.rotationStatePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Error loading rotation state:', error);
    }
    return {
      lastUsed: {}, // template_id -> timestamp
      usageHistory: [] // array of {template_id, category, timestamp}
    };
  }

  /**
   * Save rotation state to file
   */
  saveRotationState() {
    try {
      fs.writeFileSync(this.rotationStatePath, JSON.stringify(this.rotationState, null, 2));
    } catch (error) {
      console.error('Error saving rotation state:', error);
    }
  }

  /**
   * Get all available categories
   */
  getCategories() {
    return Object.keys(this.library.categories);
  }

  /**
   * Get category details
   */
  getCategory(categoryId) {
    return this.library.categories[categoryId];
  }

  /**
   * Check if template is available (not in cooldown period)
   */
  isTemplateAvailable(templateId, cooldownDays = 7) {
    const lastUsed = this.rotationState.lastUsed[templateId];
    if (!lastUsed) return true;

    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return (now - lastUsed) > cooldownMs;
  }

  /**
   * Get available templates for a category (excluding cooldown templates)
   */
  getAvailableTemplates(categoryId) {
    const category = this.library.categories[categoryId];
    if (!category) return [];

    const cooldownDays = this.library.rotation_settings?.cooldown_days || 7;
    
    return category.templates.filter(template => 
      this.isTemplateAvailable(template.id, cooldownDays)
    );
  }

  /**
   * Select a template using rotation strategy
   */
  selectTemplate(categoryId, strategy = 'random') {
    const availableTemplates = this.getAvailableTemplates(categoryId);
    
    // If no templates available (all in cooldown), reset for this category
    if (availableTemplates.length === 0) {
      console.warn(`All templates in category ${categoryId} are in cooldown. Resetting...`);
      const category = this.library.categories[categoryId];
      return category?.templates[0] || null;
    }

    switch (strategy) {
      case 'least_recently_used':
        return this.selectLeastRecentlyUsed(availableTemplates);
      case 'sequential':
        return this.selectSequential(categoryId, availableTemplates);
      case 'random':
      default:
        return availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
    }
  }

  /**
   * Select the least recently used template
   */
  selectLeastRecentlyUsed(templates) {
    return templates.reduce((oldest, current) => {
      const oldestLastUsed = this.rotationState.lastUsed[oldest.id] || 0;
      const currentLastUsed = this.rotationState.lastUsed[current.id] || 0;
      return currentLastUsed < oldestLastUsed ? current : oldest;
    });
  }

  /**
   * Select templates in sequential order
   */
  selectSequential(categoryId, templates) {
    const categoryHistory = this.rotationState.usageHistory
      .filter(h => h.category === categoryId)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const lastUsedIndex = categoryHistory.length > 0 
      ? templates.findIndex(t => t.id === categoryHistory[0].template_id)
      : -1;
    
    const nextIndex = (lastUsedIndex + 1) % templates.length;
    return templates[nextIndex];
  }

  /**
   * Replace variables in text
   */
  replaceVariables(text, variables = {}) {
    const mergedVars = { ...this.defaultValues, ...variables };
    
    return text
      .replace(/\{\{company\}\}/g, mergedVars.company || this.defaultValues.company)
      .replace(/\{\{benefit\}\}/g, mergedVars.benefit || this.defaultValues.benefit)
      .replace(/\{\{stat\}\}/g, mergedVars.stat || this.defaultValues.stat)
      .replace(/\{\{cta\}\}/g, mergedVars.cta || this.defaultValues.cta);
  }

  /**
   * Generate hashtags for a category and template
   */
  generateHashtags(categoryId, template, options = {}) {
    const category = this.library.categories[categoryId];
    if (!category) return '';

    const count = options.count || 5;
    const includeBranding = options.includeBranding !== false;
    
    // Base category hashtags
    let hashtags = [...category.hashtags];
    
    // Add template-specific hashtags if available
    if (template.hashtags_extra) {
      hashtags = [...hashtags, ...template.hashtags_extra];
    }
    
    // Add company hashtag if branding enabled
    if (includeBranding) {
      hashtags.push('#TDSolutions');
    }
    
    // Remove duplicates and shuffle
    hashtags = [...new Set(hashtags)];
    hashtags = this.shuffleArray(hashtags);
    
    // Return specified count
    return hashtags.slice(0, count).join(' ');
  }

  /**
   * Shuffle array (Fisher-Yates algorithm)
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Mark template as used
   */
  markTemplateUsed(templateId, categoryId) {
    const timestamp = Date.now();
    
    this.rotationState.lastUsed[templateId] = timestamp;
    this.rotationState.usageHistory.push({
      template_id: templateId,
      category: categoryId,
      timestamp: timestamp
    });
    
    // Keep only last 100 entries to prevent file bloat
    if (this.rotationState.usageHistory.length > 100) {
      this.rotationState.usageHistory = this.rotationState.usageHistory.slice(-100);
    }
    
    this.saveRotationState();
  }

  /**
   * Generate a caption
   */
  generateCaption(categoryId, options = {}) {
    const category = this.library.categories[categoryId];
    if (!category) {
      throw new Error(`Category '${categoryId}' not found`);
    }

    // Select template using rotation strategy
    const strategy = options.strategy || this.library.rotation_settings?.rotation_strategy || 'random';
    const template = this.selectTemplate(categoryId, strategy);
    
    if (!template) {
      throw new Error(`No templates available for category '${categoryId}'`);
    }

    // Replace variables
    const variables = options.variables || {};
    const hook = this.replaceVariables(template.hook, variables);
    const body = this.replaceVariables(template.body, variables);
    const cta = this.replaceVariables(template.cta, variables);

    // Generate hashtags
    const hashtagCount = options.hashtagCount || 6;
    const hashtags = this.generateHashtags(categoryId, template, { 
      count: hashtagCount,
      includeBranding: options.includeBranding 
    });

    // Assemble caption
    const parts = [hook, '', body];
    if (cta && cta.trim()) {
      parts.push('', cta);
    }
    parts.push('', hashtags);

    const caption = parts.join('\n');

    // Mark as used
    this.markTemplateUsed(template.id, categoryId);

    return {
      caption,
      metadata: {
        template_id: template.id,
        category: categoryId,
        category_name: category.name,
        generated_at: new Date().toISOString(),
        variables_used: variables
      }
    };
  }

  /**
   * Generate multiple captions at once
   */
  generateBatch(requests) {
    return requests.map(req => {
      try {
        return {
          success: true,
          result: this.generateCaption(req.category, req.options || {})
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          category: req.category
        };
      }
    });
  }

  /**
   * Get rotation status (for debugging/monitoring)
   */
  getRotationStatus() {
    const status = {};
    const cooldownDays = this.library.rotation_settings?.cooldown_days || 7;
    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const [categoryId, category] of Object.entries(this.library.categories)) {
      status[categoryId] = {
        name: category.name,
        total_templates: category.templates.length,
        available_templates: 0,
        in_cooldown: 0,
        templates: category.templates.map(t => {
          const lastUsed = this.rotationState.lastUsed[t.id];
          const isAvailable = !lastUsed || (now - lastUsed) > cooldownMs;
          return {
            id: t.id,
            available: isAvailable,
            last_used: lastUsed ? new Date(lastUsed).toISOString() : null
          };
        })
      };
      
      status[categoryId].available_templates = status[categoryId].templates.filter(t => t.available).length;
      status[categoryId].in_cooldown = status[categoryId].templates.filter(t => !t.available).length;
    }

    return status;
  }

  /**
   * Reset rotation state (clear all usage history)
   */
  resetRotation() {
    this.rotationState = {
      lastUsed: {},
      usageHistory: []
    };
    this.saveRotationState();
    return { success: true, message: 'Rotation state reset' };
  }

  /**
   * Get usage statistics
   */
  getStats() {
    const categoryUsage = {};
    const templateUsage = {};

    for (const entry of this.rotationState.usageHistory) {
      categoryUsage[entry.category] = (categoryUsage[entry.category] || 0) + 1;
      templateUsage[entry.template_id] = (templateUsage[entry.template_id] || 0) + 1;
    }

    return {
      total_generations: this.rotationState.usageHistory.length,
      category_usage: categoryUsage,
      most_used_templates: Object.entries(templateUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      unique_categories_used: Object.keys(categoryUsage).length,
      unique_templates_used: Object.keys(templateUsage).length
    };
  }
}

// Export for use as module
module.exports = ContentGenerator;

// CLI usage example
if (require.main === module) {
  const generator = new ContentGenerator();
  
  console.log('=== TDS E Solutions Content Generator ===\n');
  
  // Show available categories
  console.log('Available Categories:');
  generator.getCategories().forEach(cat => {
    const category = generator.getCategory(cat);
    console.log(`  - ${cat}: ${category.name} (${category.templates.length} templates)`);
  });
  
  console.log('\n--- Sample Generation ---\n');
  
  // Generate sample captions for different categories
  const samples = [
    { category: 'ai_automation_tips', options: { variables: { benefit: '40% time savings', stat: '73%' } } },
    { category: 'custom_software_solutions', options: { variables: { benefit: '2x efficiency', stat: '300%' } } },
    { category: 'meet_kiarosx', options: { variables: { company: 'TDS E Solutions' } } }
  ];
  
  samples.forEach(({ category, options }) => {
    try {
      const result = generator.generateCaption(category, options);
      console.log(`\n[${result.metadata.category_name}]`);
      console.log(result.caption);
      console.log(`\n(Template: ${result.metadata.template_id})`);
      console.log('---');
    } catch (error) {
      console.error(`Error generating for ${category}:`, error.message);
    }
  });
  
  // Show rotation status
  console.log('\n=== Rotation Status ===');
  const status = generator.getRotationStatus();
  for (const [cat, info] of Object.entries(status)) {
    console.log(`${cat}: ${info.available_templates}/${info.total_templates} templates available`);
  }
}