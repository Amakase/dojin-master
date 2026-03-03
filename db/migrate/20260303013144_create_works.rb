class CreateWorks < ActiveRecord::Migration[8.1]
  def change
    create_table :works do |t|
      t.string :title
      t.string :title_reading
      t.string :version
      t.text :description
      t.date :published_on
      t.date :orig_published_on
      t.string :medium
      t.string :size
      t.string :download_source
      t.boolean :digital
      t.boolean :adult

      t.timestamps
    end
  end
end
